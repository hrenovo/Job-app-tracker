from django.contrib import admin

from .models import AISettings, CalendarEvent, Interview, InterviewNotes, InterviewPrep, JobApplication


class InterviewInline(admin.TabularInline):
    model = Interview
    extra = 0
    fields = ['interview_type', 'round_number', 'scheduled_at', 'status', 'outcome', 'interviewer_name']
    show_change_link = True


@admin.register(JobApplication)
class JobApplicationAdmin(admin.ModelAdmin):
    list_display = ['company', 'role', 'stage', 'priority', 'date_applied', 'user', 'last_activity']
    list_filter = ['stage', 'priority', 'source', 'is_archived']
    search_fields = ['company', 'role', 'user__username']
    ordering = ['-last_activity']
    inlines = [InterviewInline]
    readonly_fields = ['last_activity', 'created_at']


class InterviewNotesInline(admin.StackedInline):
    model = InterviewNotes
    extra = 0
    fields = ['went_well', 'improve', 'dont_repeat', 'key_learnings', 'quick_notes', 'self_rating', 'difficulty_rating']
    show_change_link = True


class InterviewPrepInline(admin.StackedInline):
    model = InterviewPrep
    extra = 0
    fields = ['topics_to_study', 'questions_to_ask', 'questions_expected', 'checklist', 'free_notes']
    show_change_link = True


@admin.register(Interview)
class InterviewAdmin(admin.ModelAdmin):
    list_display = ['application', 'interview_type', 'round_number', 'scheduled_at', 'status', 'outcome', 'prep_status']
    list_filter = ['interview_type', 'status', 'outcome', 'format', 'prep_status']
    search_fields = ['application__company', 'application__role', 'interviewer_name']
    ordering = ['scheduled_at']
    inlines = [InterviewNotesInline, InterviewPrepInline]
    readonly_fields = ['created_at']


@admin.register(InterviewNotes)
class InterviewNotesAdmin(admin.ModelAdmin):
    list_display = ['interview', 'self_rating', 'difficulty_rating', 'salary_discussed', 'updated_at']
    list_filter = ['salary_discussed', 'would_prepare_differently']
    search_fields = ['interview__application__company']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(InterviewPrep)
class InterviewPrepAdmin(admin.ModelAdmin):
    list_display = ['interview', 'updated_at']
    search_fields = ['interview__application__company']
    readonly_fields = ['created_at', 'updated_at']


@admin.register(CalendarEvent)
class CalendarEventAdmin(admin.ModelAdmin):
    list_display = ['title', 'event_type', 'start_at', 'end_at', 'user']
    list_filter = ['event_type', 'all_day']
    search_fields = ['title', 'user__username']
    ordering = ['start_at']
    readonly_fields = ['created_at']


@admin.register(AISettings)
class AISettingsAdmin(admin.ModelAdmin):
    list_display = ['user', 'provider', 'ollama_model', 'openai_model', 'updated_at']
    list_filter = ['provider']
    search_fields = ['user__username']
    readonly_fields = ['created_at', 'updated_at']
