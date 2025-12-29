from django.contrib import admin
from .models import Thread, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    readonly_fields = ['sender', 'body', 'created_at']


@admin.register(Thread)
class ThreadAdmin(admin.ModelAdmin):
    list_display = ['project', 'card', 'thread_type', 'triage_state', 'last_message_at']
    list_filter = ['thread_type', 'triage_state']
    search_fields = ['project__name', 'card__title']
    raw_id_fields = ['project', 'card']
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ['thread', 'sender', 'body_preview', 'created_at']
    search_fields = ['body', 'sender__email']
    raw_id_fields = ['thread', 'sender']

    def body_preview(self, obj):
        return obj.body[:50] + '...' if len(obj.body) > 50 else obj.body
    body_preview.short_description = 'Body'
