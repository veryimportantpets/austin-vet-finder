from django.contrib import admin
from .models import Card, CardSubmission, Attachment


class AttachmentInline(admin.TabularInline):
    model = Attachment
    extra = 0
    readonly_fields = ['filename', 'file_size', 'mime_type', 'storage_backend', 'uploaded_by', 'created_at']


@admin.register(Card)
class CardAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'visibility', 'kind', 'status', 'due_date', 'required']
    list_filter = ['visibility', 'kind', 'status', 'required', 'phase']
    search_fields = ['title', 'project__name']
    raw_id_fields = ['project', 'page', 'created_by']
    date_hierarchy = 'created_at'


@admin.register(CardSubmission)
class CardSubmissionAdmin(admin.ModelAdmin):
    list_display = ['card', 'submitted_by', 'created_at']
    search_fields = ['card__title', 'text_content']
    raw_id_fields = ['card', 'submitted_by']
    inlines = [AttachmentInline]


@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ['filename', 'submission', 'message', 'file_size', 'storage_backend', 'created_at']
    list_filter = ['storage_backend']
    search_fields = ['filename']
    raw_id_fields = ['submission', 'message', 'uploaded_by']
