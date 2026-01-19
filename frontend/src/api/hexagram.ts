import axios from 'axios';
import type { InputPayload, ShakeResponse, InterpretResponse } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded; charset=utf-8',
  },
});

export async function shakeHexagram(payload: InputPayload): Promise<ShakeResponse> {
  const formData = new URLSearchParams();
  formData.append('location', payload.location);
  formData.append('timezone', payload.timezone);
  formData.append('datetime', payload.datetime);
  formData.append('querentName', payload.querentName);
  formData.append('question', payload.question);
  
  payload.lines.forEach((line, idx) => {
    formData.append(`line${idx}_index`, String(line.index));
    formData.append(`line${idx}_type`, line.type);
    formData.append(`line${idx}_isMoving`, String(line.isMoving));
  });
  
  const response = await api.post<ShakeResponse>('/shake', formData.toString());
  return response.data;
}

export async function interpretHexagram(
  payload: InputPayload & { question?: string; isFollowUp?: boolean }
): Promise<InterpretResponse> {
  const formData = new URLSearchParams();
  formData.append('location', payload.location);
  formData.append('timezone', payload.timezone);
  formData.append('datetime', payload.datetime);
  formData.append('querentName', payload.querentName);
  formData.append('question', payload.question || payload.question || '');
  
  if (payload.isFollowUp) {
    formData.append('isFollowUp', 'true');
  }
  
  if (payload.lines && payload.lines.length > 0) {
    payload.lines.forEach((line, idx) => {
      formData.append(`line${idx}_index`, String(line.index));
      formData.append(`line${idx}_type`, line.type);
      formData.append(`line${idx}_isMoving`, String(line.isMoving));
    });
  }
  
  const response = await api.post<InterpretResponse>('/interpret', formData.toString());
  return response.data;
}

export async function createPayment(amount: number, description: string, userName: string) {
  const response = await api.post('/create-payment', 
    JSON.stringify({
      amount,
      description,
      userName,
    }), 
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data;
}

export async function confirmPayment(orderId: string) {
  const response = await api.post('/payment-success', { orderId });
  return response.data;
}

export async function queryOrderStatus(orderId: string) {
  const response = await api.get(`/query-order?orderId=${orderId}`);
  return response.data;
}
