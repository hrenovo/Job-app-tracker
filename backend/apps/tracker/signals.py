from datetime import timedelta

from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver

from .models import CalendarEvent, Interview

INTERVIEW_EVENT_COLOR = '#7c3aed'
DEFAULT_DURATION_MINUTES = 60


def _build_event_title(interview):
    return (
        f"{interview.application.company} \u2014 "
        f"{interview.application.role} "
        f"({interview.get_interview_type_display()})"
    )


def _calc_end_at(interview):
    duration = interview.duration_minutes or DEFAULT_DURATION_MINUTES
    return interview.scheduled_at + timedelta(minutes=duration)


@receiver(post_save, sender=Interview)
def sync_calendar_event(sender, instance, created, **kwargs):
    if not instance.scheduled_at:
        return

    if created:
        if CalendarEvent.objects.filter(interview=instance).exists():
            return
        CalendarEvent.objects.create(
            user=instance.user,
            title=_build_event_title(instance),
            event_type=CalendarEvent.EVENT_INTERVIEW,
            start_at=instance.scheduled_at,
            end_at=_calc_end_at(instance),
            application=instance.application,
            interview=instance,
            color=INTERVIEW_EVENT_COLOR,
        )
    else:
        CalendarEvent.objects.filter(interview=instance).update(
            title=_build_event_title(instance),
            start_at=instance.scheduled_at,
            end_at=_calc_end_at(instance),
        )


@receiver(pre_delete, sender=Interview)
def delete_calendar_event(sender, instance, **kwargs):
    CalendarEvent.objects.filter(interview=instance).delete()
