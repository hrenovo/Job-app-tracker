from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AISettingsTestConnectionView,
    AISettingsView,
    CalendarEventViewSet,
    InterviewViewSet,
    JobApplicationViewSet,
    ai_chat_view,
    dashboard_stats,
    insights_view,
    login_view,
    logout_view,
    register_view,
)

router = DefaultRouter()
router.register(r'applications', JobApplicationViewSet, basename='application')
router.register(r'interviews', InterviewViewSet, basename='interview')
router.register(r'calendar', CalendarEventViewSet, basename='calendar')

urlpatterns = [
    # Auth
    path('api/auth/register/', register_view, name='auth-register'),
    path('api/auth/login/', login_view, name='auth-login'),
    path('api/auth/logout/', logout_view, name='auth-logout'),
    path('api/auth/refresh/', TokenRefreshView.as_view(), name='auth-refresh'),
    # Dashboard stats
    path('api/tracker-stats/', dashboard_stats, name='tracker-stats'),
    # Insights
    path('api/insights/', insights_view, name='insights'),
    # AI Settings (singleton)
    path('api/ai-settings/', AISettingsView.as_view(), name='ai-settings'),
    path('api/ai-settings/test-connection/', AISettingsTestConnectionView.as_view(), name='ai-settings-test'),
    # AI Chat
    path('api/ai/chat/', ai_chat_view, name='ai-chat'),
    # Resource ViewSets
    path('api/', include(router.urls)),
]
