from django.contrib import admin
from .models import ChangeRequest


@admin.register(ChangeRequest)
class ChangeRequestAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'status', 'requested_by', 'created_at']
    list_filter = ['status']
    search_fields = ['title', 'description', 'project__name']
    raw_id_fields = ['project', 'requested_by', 'responded_by']
    date_hierarchy = 'created_at'
