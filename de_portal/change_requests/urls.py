from django.urls import path
from . import views

urlpatterns = [
    path('change-requests/', views.change_request_list, name='change_requests'),
    path('change-request/<int:pk>/', views.change_request_detail, name='change_request_detail'),
    path('change-request/new/', views.create_change_request, name='create_change_request'),
    path('project/<int:pk>/change-requests/', views.change_request_list, name='project_change_requests'),
    path('project/<int:pk>/change-request/new/', views.create_change_request, name='project_create_change_request'),
    path('change-request/<int:pk>/approve/', views.approve_change_request, name='approve_change_request'),
    path('change-request/<int:pk>/decline/', views.decline_change_request, name='decline_change_request'),
    path('change-request/<int:pk>/schedule/', views.schedule_change_request, name='schedule_change_request'),
]
