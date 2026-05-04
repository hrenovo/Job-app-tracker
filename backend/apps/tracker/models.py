from django.conf import settings
from django.db import models


class JobApplication(models.Model):
    STAGE_APPLIED = 'applied'
    STAGE_SCREENING = 'screening'
    STAGE_TECHNICAL = 'technical'
    STAGE_HR_INTERVIEW = 'hr_interview'
    STAGE_FINAL_ROUND = 'final_round'
    STAGE_OFFER = 'offer'
    STAGE_REJECTED = 'rejected'
    STAGE_WITHDRAWN = 'withdrawn'
    STAGE_ARCHIVED = 'archived'

    STAGE_CHOICES = [
        (STAGE_APPLIED, 'Applied'),
        (STAGE_SCREENING, 'Screening'),
        (STAGE_TECHNICAL, 'Technical'),
        (STAGE_HR_INTERVIEW, 'HR Interview'),
        (STAGE_FINAL_ROUND, 'Final Round'),
        (STAGE_OFFER, 'Offer'),
        (STAGE_REJECTED, 'Rejected'),
        (STAGE_WITHDRAWN, 'Withdrawn'),
        (STAGE_ARCHIVED, 'Archived'),
    ]

    PRIORITY_HIGH = 'high'
    PRIORITY_MEDIUM = 'medium'
    PRIORITY_LOW = 'low'

    PRIORITY_CHOICES = [
        (PRIORITY_HIGH, 'High'),
        (PRIORITY_MEDIUM, 'Medium'),
        (PRIORITY_LOW, 'Low'),
    ]

    SOURCE_LINKEDIN = 'linkedin'
    SOURCE_REFERRAL = 'referral'
    SOURCE_DIRECT = 'direct'
    SOURCE_JOB_BOARD = 'job_board'
    SOURCE_RECRUITER = 'recruiter'
    SOURCE_OTHER = 'other'

    SOURCE_CHOICES = [
        (SOURCE_LINKEDIN, 'LinkedIn'),
        (SOURCE_REFERRAL, 'Referral'),
        (SOURCE_DIRECT, 'Direct'),
        (SOURCE_JOB_BOARD, 'Job Board'),
        (SOURCE_RECRUITER, 'Recruiter'),
        (SOURCE_OTHER, 'Other'),
    ]

    ACTIVE_STAGES = {STAGE_APPLIED, STAGE_SCREENING, STAGE_TECHNICAL, STAGE_HR_INTERVIEW, STAGE_FINAL_ROUND}

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='applications')
    company = models.CharField(max_length=200)
    role = models.CharField(max_length=200)
    location = models.CharField(max_length=200, blank=True, null=True)
    salary_range = models.CharField(max_length=100, blank=True, null=True)
    stage = models.CharField(max_length=30, choices=STAGE_CHOICES, default=STAGE_APPLIED)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default=PRIORITY_MEDIUM)
    date_applied = models.DateField()
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, blank=True, null=True)
    next_step = models.TextField(blank=True, null=True)
    next_interview_date = models.DateTimeField(blank=True, null=True)
    contact_name = models.CharField(max_length=200, blank=True, null=True)
    contact_email = models.EmailField(blank=True, null=True)
    resume_version = models.CharField(max_length=100, blank=True, null=True)
    job_url = models.URLField(blank=True, null=True)
    last_activity = models.DateTimeField(auto_now=True)
    notes = models.TextField(blank=True, null=True)
    is_archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tracker_job_applications'
        ordering = ['-last_activity']

    def __str__(self):
        return f"{self.company} — {self.role} ({self.stage})"


class Interview(models.Model):
    TYPE_PHONE_SCREEN = 'phone_screen'
    TYPE_TECHNICAL = 'technical'
    TYPE_HR = 'hr'
    TYPE_ON_SITE = 'on_site'
    TYPE_FINAL_ROUND = 'final_round'
    TYPE_TAKE_HOME = 'take_home'
    TYPE_OTHER = 'other'

    TYPE_CHOICES = [
        (TYPE_PHONE_SCREEN, 'Phone Screen'),
        (TYPE_TECHNICAL, 'Technical'),
        (TYPE_HR, 'HR'),
        (TYPE_ON_SITE, 'On Site'),
        (TYPE_FINAL_ROUND, 'Final Round'),
        (TYPE_TAKE_HOME, 'Take Home'),
        (TYPE_OTHER, 'Other'),
    ]

    FORMAT_VIDEO = 'video'
    FORMAT_PHONE = 'phone'
    FORMAT_IN_PERSON = 'in_person'
    FORMAT_TAKE_HOME = 'take_home'

    FORMAT_CHOICES = [
        (FORMAT_VIDEO, 'Video'),
        (FORMAT_PHONE, 'Phone'),
        (FORMAT_IN_PERSON, 'In Person'),
        (FORMAT_TAKE_HOME, 'Take Home'),
    ]

    STATUS_SCHEDULED = 'scheduled'
    STATUS_COMPLETED = 'completed'
    STATUS_CANCELLED = 'cancelled'
    STATUS_NO_SHOW = 'no_show'

    STATUS_CHOICES = [
        (STATUS_SCHEDULED, 'Scheduled'),
        (STATUS_COMPLETED, 'Completed'),
        (STATUS_CANCELLED, 'Cancelled'),
        (STATUS_NO_SHOW, 'No Show'),
    ]

    OUTCOME_PASSED = 'passed'
    OUTCOME_FAILED = 'failed'
    OUTCOME_PENDING = 'pending'
    OUTCOME_WITHDRAWN = 'withdrawn'

    OUTCOME_CHOICES = [
        (OUTCOME_PASSED, 'Passed'),
        (OUTCOME_FAILED, 'Failed'),
        (OUTCOME_PENDING, 'Pending'),
        (OUTCOME_WITHDRAWN, 'Withdrawn'),
    ]

    PREP_NOT_STARTED = 'not_started'
    PREP_IN_PROGRESS = 'in_progress'
    PREP_READY = 'ready'

    PREP_CHOICES = [
        (PREP_NOT_STARTED, 'Not Started'),
        (PREP_IN_PROGRESS, 'In Progress'),
        (PREP_READY, 'Ready'),
    ]

    application = models.ForeignKey(JobApplication, on_delete=models.CASCADE, related_name='interviews')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interviews')
    interview_type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    round_number = models.PositiveIntegerField(default=1)
    scheduled_at = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(blank=True, null=True)
    format = models.CharField(max_length=20, choices=FORMAT_CHOICES, blank=True, null=True)
    platform = models.CharField(max_length=100, blank=True, null=True)
    interviewer_name = models.CharField(max_length=200, blank=True, null=True)
    interviewer_role = models.CharField(max_length=200, blank=True, null=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    outcome = models.CharField(max_length=20, choices=OUTCOME_CHOICES, default=OUTCOME_PENDING)
    follow_up_sent = models.BooleanField(default=False)
    prep_status = models.CharField(max_length=20, choices=PREP_CHOICES, default=PREP_NOT_STARTED)
    google_calendar_event_id = models.CharField(max_length=200, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tracker_interviews'
        ordering = ['scheduled_at']

    def __str__(self):
        return f"{self.application.company} — {self.get_interview_type_display()} (Round {self.round_number})"


class InterviewNotes(models.Model):
    interview = models.OneToOneField(Interview, on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interview_notes')
    quick_notes = models.TextField(blank=True, null=True)
    went_well = models.TextField(blank=True, null=True)
    improve = models.TextField(blank=True, null=True)
    dont_repeat = models.TextField(blank=True, null=True)
    key_learnings = models.TextField(blank=True, null=True)
    self_rating = models.PositiveSmallIntegerField(blank=True, null=True)
    difficulty_rating = models.PositiveSmallIntegerField(blank=True, null=True)
    would_prepare_differently = models.BooleanField(null=True)
    prepare_differently_note = models.TextField(blank=True, null=True)
    company_impression = models.TextField(blank=True, null=True)
    salary_discussed = models.BooleanField(default=False)
    salary_amount = models.CharField(max_length=100, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tracker_interview_notes'
        verbose_name_plural = 'Interview Notes'

    def __str__(self):
        return f"Notes: {self.interview}"


class InterviewPrep(models.Model):
    interview = models.OneToOneField(Interview, on_delete=models.CASCADE, related_name='prep')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='interview_preps')
    topics_to_study = models.JSONField(default=list)
    questions_to_ask = models.TextField(blank=True, null=True)
    questions_expected = models.TextField(blank=True, null=True)
    checklist = models.JSONField(default=list)
    useful_links = models.JSONField(default=list)
    free_notes = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tracker_interview_prep'
        verbose_name_plural = 'Interview Preps'

    def __str__(self):
        return f"Prep: {self.interview}"


class CalendarEvent(models.Model):
    EVENT_INTERVIEW = 'interview'
    EVENT_FOLLOW_UP = 'follow_up'
    EVENT_DEADLINE = 'deadline'
    EVENT_PREP_SESSION = 'prep_session'
    EVENT_CUSTOM = 'custom'

    EVENT_TYPE_CHOICES = [
        (EVENT_INTERVIEW, 'Interview'),
        (EVENT_FOLLOW_UP, 'Follow Up'),
        (EVENT_DEADLINE, 'Deadline'),
        (EVENT_PREP_SESSION, 'Prep Session'),
        (EVENT_CUSTOM, 'Custom'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    event_type = models.CharField(max_length=20, choices=EVENT_TYPE_CHOICES)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    all_day = models.BooleanField(default=False)
    location = models.CharField(max_length=200, blank=True, null=True)
    application = models.ForeignKey(
        JobApplication, blank=True, null=True, on_delete=models.SET_NULL, related_name='calendar_events'
    )
    interview = models.ForeignKey(
        Interview, blank=True, null=True, on_delete=models.SET_NULL, related_name='calendar_events'
    )
    google_calendar_event_id = models.CharField(max_length=200, blank=True, null=True)
    color = models.CharField(max_length=20, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'tracker_calendar_events'
        ordering = ['start_at']

    def __str__(self):
        return f"{self.title} ({self.start_at})"


class AISettings(models.Model):
    PROVIDER_OLLAMA = 'ollama'
    PROVIDER_OPENAI = 'openai'
    PROVIDER_GEMINI = 'gemini'
    PROVIDER_ANTHROPIC = 'anthropic'

    PROVIDER_CHOICES = [
        (PROVIDER_OLLAMA, 'Ollama'),
        (PROVIDER_OPENAI, 'OpenAI'),
        (PROVIDER_GEMINI, 'Gemini'),
        (PROVIDER_ANTHROPIC, 'Anthropic'),
    ]

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='ai_settings')
    provider = models.CharField(max_length=20, choices=PROVIDER_CHOICES, default=PROVIDER_OLLAMA)
    ollama_base_url = models.CharField(max_length=500, default='http://localhost:11434')
    ollama_model = models.CharField(max_length=100, default='llama3')
    openai_api_key = models.CharField(max_length=200, blank=True, null=True)
    openai_model = models.CharField(max_length=100, default='gpt-4o')
    gemini_api_key = models.CharField(max_length=200, blank=True, null=True)
    gemini_model = models.CharField(max_length=100, default='gemini-1.5-pro')
    anthropic_api_key = models.CharField(max_length=200, blank=True, null=True)
    anthropic_model = models.CharField(max_length=100, default='claude-3-5-sonnet-20241022')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'tracker_ai_settings'
        verbose_name_plural = 'AI Settings'

    def __str__(self):
        return f"AI Settings: {self.user} ({self.provider})"
