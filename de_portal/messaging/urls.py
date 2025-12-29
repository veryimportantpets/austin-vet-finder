from django.urls import path
from . import views

urlpatterns = [
    path('messages/', views.messages_view, name='messages'),
    path('thread/<int:pk>/', views.thread_detail, name='thread_detail'),
    path('thread/<int:pk>/message/', views.post_message, name='post_message'),
    path('thread/<int:pk>/resolve/', views.mark_resolved, name='mark_resolved'),
    path('thread/<int:pk>/triage/', views.set_triage_state, name='set_triage_state'),
]
