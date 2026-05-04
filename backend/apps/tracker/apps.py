from django.apps import AppConfig


class TrackerConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.tracker'
    verbose_name = 'Job Tracker'

    def ready(self):
        import apps.tracker.signals  # noqa: F401
