from rest_framework import serializers

from .models import (
    AISettings,
    CalendarEvent,
    Interview,
    InterviewNotes,
    InterviewPrep,
    JobApplication,
)


class InterviewNotesSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewNotes
        fields = [
            'id', 'interview', 'quick_notes', 'went_well', 'improve', 'dont_repeat',
            'key_learnings', 'self_rating', 'difficulty_rating', 'would_prepare_differently',
            'prepare_differently_note', 'company_impression', 'salary_discussed',
            'salary_amount', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'interview', 'created_at', 'updated_at']


class InterviewPrepSerializer(serializers.ModelSerializer):
    class Meta:
        model = InterviewPrep
        fields = [
            'id', 'interview', 'topics_to_study', 'questions_to_ask', 'questions_expected',
            'checklist', 'useful_links', 'free_notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'interview', 'created_at', 'updated_at']


class InterviewSerializer(serializers.ModelSerializer):
    application_company = serializers.CharField(source='application.company', read_only=True)
    application_role = serializers.CharField(source='application.role', read_only=True)
    notes = InterviewNotesSerializer(read_only=True)
    prep = InterviewPrepSerializer(read_only=True)

    class Meta:
        model = Interview
        fields = [
            'id', 'application', 'application_company', 'application_role',
            'interview_type', 'round_number', 'scheduled_at', 'duration_minutes',
            'format', 'platform', 'interviewer_name', 'interviewer_role',
            'status', 'outcome', 'follow_up_sent', 'prep_status',
            'google_calendar_event_id', 'notes', 'prep', 'created_at',
        ]
        read_only_fields = ['id', 'google_calendar_event_id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class InterviewListSerializer(serializers.ModelSerializer):
    """Lighter serializer for list views (no nested notes/prep)."""
    application_company = serializers.CharField(source='application.company', read_only=True)
    application_role = serializers.CharField(source='application.role', read_only=True)

    class Meta:
        model = Interview
        fields = [
            'id', 'application', 'application_company', 'application_role',
            'interview_type', 'round_number', 'scheduled_at', 'duration_minutes',
            'format', 'platform', 'interviewer_name', 'interviewer_role',
            'status', 'outcome', 'follow_up_sent', 'prep_status',
            'google_calendar_event_id', 'created_at',
        ]
        read_only_fields = ['id', 'google_calendar_event_id', 'created_at']


class JobApplicationSerializer(serializers.ModelSerializer):
    interview_count = serializers.IntegerField(read_only=True)
    next_interview = serializers.DateTimeField(read_only=True)

    class Meta:
        model = JobApplication
        fields = [
            'id', 'company', 'role', 'location', 'salary_range', 'stage', 'priority',
            'date_applied', 'source', 'next_step', 'next_interview_date',
            'contact_name', 'contact_email', 'resume_version', 'job_url',
            'last_activity', 'notes', 'is_archived', 'created_at',
            'interview_count', 'next_interview',
        ]
        read_only_fields = ['id', 'last_activity', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class JobApplicationDetailSerializer(JobApplicationSerializer):
    """Detail serializer with nested interviews."""
    interviews = InterviewListSerializer(many=True, read_only=True)

    class Meta(JobApplicationSerializer.Meta):
        fields = JobApplicationSerializer.Meta.fields + ['interviews']


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = [
            'id', 'title', 'description', 'event_type', 'start_at', 'end_at',
            'all_day', 'location', 'application', 'interview',
            'google_calendar_event_id', 'color', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def create(self, validated_data):
        validated_data['user'] = self.context['request'].user
        return super().create(validated_data)


class AISettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = AISettings
        fields = [
            'id', 'provider', 'ollama_base_url', 'ollama_model',
            'openai_api_key', 'openai_model',
            'gemini_api_key', 'gemini_model',
            'anthropic_api_key', 'anthropic_model',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
