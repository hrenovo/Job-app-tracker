import io
import zipfile as zf
from datetime import timedelta

import django_filters
import requests
from django.contrib.auth import authenticate, get_user_model
from django.db.models import Avg, Count, OuterRef, Q, Subquery
from django.db.models.functions import TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, authentication_classes, permission_classes
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    AISettings,
    CalendarEvent,
    Interview,
    InterviewNotes,
    InterviewPrep,
    JobApplication,
)
from .serializers import (
    AISettingsSerializer,
    CalendarEventSerializer,
    InterviewListSerializer,
    InterviewNotesSerializer,
    InterviewPrepSerializer,
    InterviewSerializer,
    JobApplicationDetailSerializer,
    JobApplicationSerializer,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Pagination
# ---------------------------------------------------------------------------

class StandardPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ---------------------------------------------------------------------------
# Auth endpoints
# ---------------------------------------------------------------------------

@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def register_view(request):
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response({'error': 'username and password are required'}, status=400)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already taken'}, status=400)

    user = User.objects.create_user(username=username, email=email, password=password)
    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
    }, status=201)


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def login_view(request):
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '')

    if not username or not password:
        return Response({'error': 'username and password are required'}, status=400)

    user = authenticate(request, username=username, password=password)
    if not user:
        return Response({'error': 'Invalid credentials'}, status=401)

    refresh = RefreshToken.for_user(user)
    return Response({
        'access': str(refresh.access_token),
        'refresh': str(refresh),
        'user': {'id': user.id, 'username': user.username, 'email': user.email},
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout_view(request):
    try:
        token = RefreshToken(request.data.get('refresh', ''))
        token.blacklist()
    except Exception:
        pass
    return Response(status=204)


# ---------------------------------------------------------------------------
# Dashboard stats
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    user = request.user
    now = timezone.now()
    two_weeks_later = now + timedelta(days=14)

    applications = JobApplication.objects.filter(user=user)
    total = applications.count()
    in_pipeline = applications.filter(stage__in=JobApplication.ACTIVE_STAGES).count()
    offers = applications.filter(stage=JobApplication.STAGE_OFFER).count()

    responded = applications.exclude(stage=JobApplication.STAGE_APPLIED).count()
    response_rate = round((responded / total * 100), 1) if total > 0 else 0.0

    upcoming_count = Interview.objects.filter(
        user=user,
        scheduled_at__gte=now,
        scheduled_at__lte=two_weeks_later,
    ).count()

    pipeline_breakdown = {
        choice[0]: applications.filter(stage=choice[0]).count()
        for choice in JobApplication.STAGE_CHOICES
    }

    upcoming_list = (
        Interview.objects.filter(user=user, scheduled_at__gte=now)
        .select_related('application')
        .order_by('scheduled_at')[:5]
    )

    recent_activity = list(
        applications.order_by('-last_activity')[:5]
        .values('id', 'company', 'role', 'stage', 'last_activity')
    )

    return Response({
        'total_applications': total,
        'in_pipeline': in_pipeline,
        'upcoming_interviews': upcoming_count,
        'offers': offers,
        'response_rate': response_rate,
        'pipeline_breakdown': pipeline_breakdown,
        'upcoming_interviews_list': [
            {
                'id': iv.id,
                'company': iv.application.company,
                'role': iv.application.role,
                'interview_type': iv.interview_type,
                'scheduled_at': iv.scheduled_at,
                'application_id': iv.application_id,
            }
            for iv in upcoming_list
        ],
        'recent_activity': recent_activity,
    })


# ---------------------------------------------------------------------------
# Insights
# ---------------------------------------------------------------------------

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def insights_view(request):
    user = request.user
    now = timezone.now()
    twelve_months_ago = now - timedelta(days=365)
    six_months_ago = now - timedelta(days=180)

    applications = JobApplication.objects.filter(user=user)
    interviews = Interview.objects.filter(user=user)
    notes = InterviewNotes.objects.filter(user=user)

    total_applications = applications.count()

    by_stage = dict(
        applications.values('stage').annotate(count=Count('id')).values_list('stage', 'count')
    )

    responded = applications.exclude(stage=JobApplication.STAGE_APPLIED).count()
    response_rate = round(responded / total_applications * 100, 1) if total_applications > 0 else 0.0

    total_completed = interviews.filter(status=Interview.STATUS_COMPLETED).count()
    passed = interviews.filter(outcome=Interview.OUTCOME_PASSED).count()
    interview_pass_rate = round(passed / total_completed * 100, 1) if total_completed > 0 else 0.0

    applications_by_source = dict(
        applications.values('source').annotate(count=Count('id')).values_list('source', 'count')
    )

    by_month_qs = (
        applications.filter(date_applied__gte=twelve_months_ago.date())
        .annotate(month=TruncMonth('date_applied'))
        .values('month')
        .annotate(count=Count('id'))
        .order_by('month')
    )
    applications_by_month = [
        {'month': item['month'].strftime('%Y-%m'), 'count': item['count']}
        for item in by_month_qs
    ]

    outcomes_by_month_qs = (
        interviews.filter(created_at__gte=six_months_ago)
        .annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(
            passed=Count('id', filter=Q(outcome=Interview.OUTCOME_PASSED)),
            failed=Count('id', filter=Q(outcome=Interview.OUTCOME_FAILED)),
            pending=Count('id', filter=Q(outcome=Interview.OUTCOME_PENDING)),
        )
        .order_by('month')
    )
    outcomes_by_month = [
        {
            'month': item['month'].strftime('%Y-%m'),
            'passed': item['passed'],
            'failed': item['failed'],
            'pending': item['pending'],
        }
        for item in outcomes_by_month_qs
    ]

    avg_self_rating_result = notes.aggregate(avg=Avg('self_rating'))
    avg_self_rating = round(float(avg_self_rating_result['avg']), 2) if avg_self_rating_result['avg'] else 0.0

    self_rating_by_month_qs = (
        notes.filter(created_at__gte=six_months_ago)
        .annotate(month=TruncMonth('created_at'))
        .values('month')
        .annotate(avg_rating=Avg('self_rating'))
        .order_by('month')
    )
    self_rating_by_month = [
        {'month': item['month'].strftime('%Y-%m'), 'avg_rating': round(float(item['avg_rating']), 2)}
        for item in self_rating_by_month_qs
    ]

    weak_areas_qs = notes.exclude(
        Q(dont_repeat__isnull=True) | Q(dont_repeat=''),
    ).values('dont_repeat', 'improve')[:20]
    top_weak_areas = []
    for item in weak_areas_qs:
        if item['dont_repeat']:
            top_weak_areas.append(item['dont_repeat'][:200])
        if item['improve']:
            top_weak_areas.append(item['improve'][:200])
    top_weak_areas = top_weak_areas[:10]

    first_interview_subq = Interview.objects.filter(
        application=OuterRef('pk')
    ).order_by('scheduled_at').values('scheduled_at')[:1]

    apps_with_interview = applications.annotate(
        first_interview=Subquery(first_interview_subq)
    ).filter(first_interview__isnull=False)

    total_days = 0
    count_with_interview = 0
    for app in apps_with_interview:
        if app.first_interview and app.date_applied:
            days = (app.first_interview.date() - app.date_applied).days
            if days >= 0:
                total_days += days
                count_with_interview += 1

    avg_days_to_first_interview = (
        round(total_days / count_with_interview, 1) if count_with_interview > 0 else 0.0
    )

    return Response({
        'total_applications': total_applications,
        'by_stage': by_stage,
        'response_rate': response_rate,
        'interview_pass_rate': interview_pass_rate,
        'avg_days_to_first_interview': avg_days_to_first_interview,
        'applications_by_source': applications_by_source,
        'applications_by_month': applications_by_month,
        'outcomes_by_month': outcomes_by_month,
        'avg_self_rating': avg_self_rating,
        'self_rating_by_month': self_rating_by_month,
        'top_weak_areas': top_weak_areas,
    })


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class JobApplicationFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    ordering = django_filters.OrderingFilter(
        fields=(
            ('date_applied', 'date_applied'),
            ('last_activity', 'last_activity'),
            ('next_interview_date', 'next_interview_date'),
        )
    )

    class Meta:
        model = JobApplication
        fields = ['stage', 'priority', 'is_archived', 'source']

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(company__icontains=value) | Q(role__icontains=value)
        )


class InterviewFilter(django_filters.FilterSet):
    ordering = django_filters.OrderingFilter(
        fields=(('scheduled_at', 'scheduled_at'),)
    )

    class Meta:
        model = Interview
        fields = ['status', 'outcome', 'interview_type', 'application']


class CalendarEventFilter(django_filters.FilterSet):
    start_after = django_filters.DateTimeFilter(field_name='start_at', lookup_expr='gte')
    start_before = django_filters.DateTimeFilter(field_name='start_at', lookup_expr='lte')

    class Meta:
        model = CalendarEvent
        fields = ['event_type']


# ---------------------------------------------------------------------------
# Helper: generate Markdown for interview notes
# ---------------------------------------------------------------------------

def _generate_notes_markdown(interview):
    app = interview.application
    lines = [
        f"# Interview Notes: {app.company} — {app.role}",
        f"**Type:** {interview.get_interview_type_display()}  ",
        f"**Round:** {interview.round_number}  ",
        f"**Scheduled:** {interview.scheduled_at.strftime('%Y-%m-%d %H:%M') if interview.scheduled_at else 'N/A'}  ",
        f"**Status:** {interview.get_status_display()}  ",
        f"**Outcome:** {interview.get_outcome_display()}  ",
        "",
    ]

    try:
        n = interview.notes
        if n.quick_notes:
            lines += ["## Quick Notes", n.quick_notes, ""]
        if n.went_well:
            lines += ["## What Went Well", n.went_well, ""]
        if n.improve:
            lines += ["## What to Improve", n.improve, ""]
        if n.dont_repeat:
            lines += ["## What Not to Repeat", n.dont_repeat, ""]
        if n.key_learnings:
            lines += ["## Key Learnings", n.key_learnings, ""]
        if n.company_impression:
            lines += ["## Company Impression", n.company_impression, ""]
        if n.self_rating:
            lines.append(f"**Self Rating:** {n.self_rating}/5  ")
        if n.difficulty_rating:
            lines.append(f"**Difficulty:** {n.difficulty_rating}/5  ")
        if n.salary_discussed:
            lines.append(f"**Salary Discussed:** Yes — {n.salary_amount or 'not specified'}  ")
    except InterviewNotes.DoesNotExist:
        lines.append("*No notes recorded.*")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------

class JobApplicationViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_class = JobApplicationFilter
    pagination_class = StandardPagination

    def get_queryset(self):
        next_interview_subq = Interview.objects.filter(
            application=OuterRef('pk'),
            scheduled_at__gte=timezone.now(),
        ).order_by('scheduled_at').values('scheduled_at')[:1]

        return (
            JobApplication.objects.filter(user=self.request.user)
            .annotate(
                interview_count=Count('interviews'),
                next_interview=Subquery(next_interview_subq),
            )
            .order_by('-last_activity')
        )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return JobApplicationDetailSerializer
        return JobApplicationSerializer

    @action(detail=True, methods=['post'])
    def archive(self, request, pk=None):
        application = self.get_object()
        application.is_archived = True
        application.save(update_fields=['is_archived'])
        return Response({'status': 'archived'})


class InterviewViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_class = InterviewFilter
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            Interview.objects.filter(user=self.request.user)
            .select_related('application')
            .prefetch_related('notes', 'prep')
        )

    def get_serializer_class(self):
        if self.action in ('retrieve', 'create', 'update', 'partial_update'):
            return InterviewSerializer
        return InterviewListSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    @action(detail=True, methods=['get', 'patch'], url_path='notes')
    def notes(self, request, pk=None):
        interview = self.get_object()

        if request.method == 'GET':
            notes_obj, _ = InterviewNotes.objects.get_or_create(
                interview=interview,
                defaults={'user': request.user},
            )
            return Response(InterviewNotesSerializer(notes_obj).data)

        # PATCH
        notes_obj, _ = InterviewNotes.objects.get_or_create(
            interview=interview,
            defaults={'user': request.user},
        )
        serializer = InterviewNotesSerializer(notes_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'patch'], url_path='prep')
    def prep(self, request, pk=None):
        interview = self.get_object()

        if request.method == 'GET':
            prep_obj, _ = InterviewPrep.objects.get_or_create(
                interview=interview,
                defaults={'user': request.user},
            )
            return Response(InterviewPrepSerializer(prep_obj).data)

        # PATCH
        prep_obj, _ = InterviewPrep.objects.get_or_create(
            interview=interview,
            defaults={'user': request.user},
        )
        serializer = InterviewPrepSerializer(prep_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='download-notes')
    def download_notes(self, request, pk=None):
        interview = self.get_object()
        md = _generate_notes_markdown(interview)
        company = interview.application.company.replace(' ', '_')
        interview_type = interview.get_interview_type_display().replace(' ', '_')
        filename = f"notes-{company}-{interview_type}-{interview.id}.md"
        response = HttpResponse(md, content_type='text/markdown; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=['get'], url_path='bulk-download-notes')
    def bulk_download_notes(self, request):
        interview_ids = request.query_params.getlist('interview_ids[]')
        if not interview_ids:
            return Response({'error': 'interview_ids[] is required'}, status=400)

        interviews = (
            Interview.objects.filter(id__in=interview_ids, user=request.user)
            .select_related('application')
            .prefetch_related('notes')
        )

        if interviews.count() == 1:
            interview = interviews.first()
            md = _generate_notes_markdown(interview)
            company = interview.application.company.replace(' ', '_')
            filename = f"notes-{company}-{interview.id}.md"
            response = HttpResponse(md, content_type='text/markdown; charset=utf-8')
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        buffer = io.BytesIO()
        with zf.ZipFile(buffer, 'w', zf.ZIP_DEFLATED) as zip_file:
            for interview in interviews:
                md = _generate_notes_markdown(interview)
                company = interview.application.company.replace(' ', '_')
                interview_type = interview.get_interview_type_display().replace(' ', '_')
                fname = f"notes-{company}-{interview_type}-{interview.id}.md"
                zip_file.writestr(fname, md)
        buffer.seek(0)
        response = HttpResponse(buffer.read(), content_type='application/zip')
        response['Content-Disposition'] = 'attachment; filename="interview-notes.zip"'
        return response


class CalendarEventViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated]
    filterset_class = CalendarEventFilter
    pagination_class = StandardPagination

    def get_queryset(self):
        return CalendarEvent.objects.filter(user=self.request.user)

    def get_serializer_class(self):
        return CalendarEventSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AISettingsView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_or_create(self, user):
        settings_obj, _ = AISettings.objects.get_or_create(user=user)
        return settings_obj

    def get(self, request):
        settings_obj = self._get_or_create(request.user)
        return Response(AISettingsSerializer(settings_obj).data)

    def patch(self, request):
        settings_obj = self._get_or_create(request.user)
        serializer = AISettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def post(self, request):
        # Only used to dispatch to test-connection — handled by URL routing
        return Response({'error': 'Use /api/ai-settings/test-connection/'}, status=400)


class AISettingsTestConnectionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        settings_obj, _ = AISettings.objects.get_or_create(user=request.user)
        provider = settings_obj.provider

        try:
            if provider == AISettings.PROVIDER_OLLAMA:
                resp = requests.get(
                    f"{settings_obj.ollama_base_url}/api/tags", timeout=5
                )
                success = resp.ok
                message = "Connected to Ollama" if success else f"Ollama error: {resp.status_code}"

            elif provider == AISettings.PROVIDER_OPENAI:
                if not settings_obj.openai_api_key:
                    return Response({'success': False, 'message': 'OpenAI API key not configured'})
                resp = requests.get(
                    'https://api.openai.com/v1/models',
                    headers={'Authorization': f'Bearer {settings_obj.openai_api_key}'},
                    timeout=10,
                )
                success = resp.ok
                message = "Connected to OpenAI" if success else f"OpenAI error: {resp.status_code}"

            elif provider == AISettings.PROVIDER_GEMINI:
                if not settings_obj.gemini_api_key:
                    return Response({'success': False, 'message': 'Gemini API key not configured'})
                resp = requests.get(
                    f'https://generativelanguage.googleapis.com/v1beta/models?key={settings_obj.gemini_api_key}',
                    timeout=10,
                )
                success = resp.ok
                message = "Connected to Gemini" if success else f"Gemini error: {resp.status_code}"

            elif provider == AISettings.PROVIDER_ANTHROPIC:
                if not settings_obj.anthropic_api_key:
                    return Response({'success': False, 'message': 'Anthropic API key not configured'})
                resp = requests.post(
                    'https://api.anthropic.com/v1/messages',
                    headers={
                        'x-api-key': settings_obj.anthropic_api_key,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    json={
                        'model': settings_obj.anthropic_model,
                        'max_tokens': 10,
                        'messages': [{'role': 'user', 'content': 'Hi'}],
                    },
                    timeout=15,
                )
                success = resp.ok
                message = "Connected to Anthropic" if success else f"Anthropic error: {resp.status_code}"

            else:
                return Response({'success': False, 'message': f'Unknown provider: {provider}'})

        except requests.exceptions.RequestException as exc:
            return Response({'success': False, 'message': str(exc)})

        return Response({'success': success, 'message': message})


# ---------------------------------------------------------------------------
# AI chat
# ---------------------------------------------------------------------------

def _chat_ollama(settings_obj, messages):
    resp = requests.post(
        f"{settings_obj.ollama_base_url}/api/chat",
        json={'model': settings_obj.ollama_model, 'messages': messages, 'stream': False},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()['message']['content']


def _chat_openai(settings_obj, messages):
    if not settings_obj.openai_api_key:
        raise ValueError('OpenAI API key not configured')
    resp = requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={
            'Authorization': f'Bearer {settings_obj.openai_api_key}',
            'Content-Type': 'application/json',
        },
        json={'model': settings_obj.openai_model, 'messages': messages},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()['choices'][0]['message']['content']


def _chat_gemini(settings_obj, messages):
    if not settings_obj.gemini_api_key:
        raise ValueError('Gemini API key not configured')

    # Extract system message and convert to Gemini format
    system_instruction = None
    gemini_contents = []
    role_map = {'user': 'user', 'assistant': 'model'}

    for msg in messages:
        role = msg.get('role')
        content = msg.get('content', '')
        if role == 'system':
            system_instruction = content
        else:
            gemini_contents.append({
                'role': role_map.get(role, 'user'),
                'parts': [{'text': content}],
            })

    body = {'contents': gemini_contents}
    if system_instruction:
        body['system_instruction'] = {'parts': [{'text': system_instruction}]}

    resp = requests.post(
        f'https://generativelanguage.googleapis.com/v1beta/models/{settings_obj.gemini_model}:generateContent?key={settings_obj.gemini_api_key}',
        json=body,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()['candidates'][0]['content']['parts'][0]['text']


def _chat_anthropic(settings_obj, messages):
    if not settings_obj.anthropic_api_key:
        raise ValueError('Anthropic API key not configured')

    system_content = None
    anthropic_messages = []
    for msg in messages:
        role = msg.get('role')
        content = msg.get('content', '')
        if role == 'system':
            system_content = content
        else:
            anthropic_messages.append({'role': role, 'content': content})

    payload = {
        'model': settings_obj.anthropic_model,
        'max_tokens': 1024,
        'messages': anthropic_messages,
    }
    if system_content:
        payload['system'] = system_content

    resp = requests.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'x-api-key': settings_obj.anthropic_api_key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()['content'][0]['text']


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_chat_view(request):
    message = request.data.get('message', '').strip()
    conversation_history = request.data.get('conversation_history', [])

    if not message:
        return Response({'error': 'message is required'}, status=400)

    user = request.user
    settings_obj, _ = AISettings.objects.get_or_create(user=user)

    now = timezone.now()
    total_apps = JobApplication.objects.filter(user=user).count()
    upcoming_interviews = Interview.objects.filter(
        user=user,
        status=Interview.STATUS_SCHEDULED,
        scheduled_at__gte=now,
    ).count()
    passed_interviews = Interview.objects.filter(
        user=user, outcome=Interview.OUTCOME_PASSED
    ).count()

    system_prompt = (
        f"You are a job search coach. The user has {total_apps} applications, "
        f"{upcoming_interviews} interviews scheduled, {passed_interviews} passed. "
        "Help them with career advice, interview prep, and pattern analysis from their job search data."
    )

    messages = [{'role': 'system', 'content': system_prompt}]
    messages.extend(conversation_history)
    messages.append({'role': 'user', 'content': message})

    try:
        provider = settings_obj.provider
        if provider == AISettings.PROVIDER_OLLAMA:
            reply = _chat_ollama(settings_obj, messages)
        elif provider == AISettings.PROVIDER_OPENAI:
            reply = _chat_openai(settings_obj, messages)
        elif provider == AISettings.PROVIDER_GEMINI:
            reply = _chat_gemini(settings_obj, messages)
        elif provider == AISettings.PROVIDER_ANTHROPIC:
            reply = _chat_anthropic(settings_obj, messages)
        else:
            return Response({'error': f'Unknown provider: {provider}'}, status=400)
    except requests.exceptions.HTTPError as exc:
        return Response({'error': f'Provider error: {exc.response.status_code}'}, status=502)
    except Exception as exc:
        return Response({'error': str(exc)}, status=502)

    return Response({'reply': reply})
