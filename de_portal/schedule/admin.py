from django.contrib import admin
from .models import ScheduleItem


@admin.register(ScheduleItem)
class ScheduleItemAdmin(admin.ModelAdmin):
    list_display = ['title', 'project', 'page', 'date', 'status', 'assigned_designer']
    list_filter = ['status', 'date']
    search_fields = ['title', 'project__name']
    raw_id_fields = ['project', 'page', 'assigned_designer']
    date_hierarchy = 'date'
