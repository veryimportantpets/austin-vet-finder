from django.contrib import admin
from .models import Notification, EmailLog


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'title', 'is_read', 'is_critical', 'created_at']
    list_filter = ['notification_type', 'is_read', 'is_critical']
    search_fields = ['user__email', 'title', 'message']
    raw_id_fields = ['user', 'project']
    date_hierarchy = 'created_at'


@admin.register(EmailLog)
class EmailLogAdmin(admin.ModelAdmin):
    list_display = ['user', 'notification_type', 'subject', 'is_critical', 'sent_at']
    list_filter = ['notification_type', 'is_critical']
    search_fields = ['user__email', 'subject']
    raw_id_fields = ['user']
    date_hierarchy = 'sent_at'
