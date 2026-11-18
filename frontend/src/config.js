import { Capacitor } from '@capacitor/core';

export const IS_NATIVE = Capacitor.isNativePlatform();

// Thay bằng link Render thật của bạn (KHÔNG có dấu / ở cuối)
const NATIVE_SERVER_URL = 'https://appkiemdo.onrender.com';

export const ROOT_URL = IS_NATIVE
    ? NATIVE_SERVER_URL
    : (window.location.hostname === 'localhost' ? 'http://localhost:5270' : '');

export const API_BASE_URL = `${ROOT_URL}/api`;