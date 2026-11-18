import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import Home from './pages/Home'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

// 🛡️ Cửa ải số 1: Yêu cầu phải có Token
const PrivateRoute = ({ children }) => {
    const token = localStorage.getItem('token');
    return token ? children : <Navigate to="/login" />;
};

// 🛡️ Cửa ải số 2: Yêu cầu phải là Quản lý
const AdminRoute = ({ children }) => {
    const role = localStorage.getItem('role');
    return role === 'Manager' ? children : <Navigate to="/" />;
};

function App() {
    return (
        <BrowserRouter>
            <ToastContainer position="top-right" autoClose={3000} />

            <Routes>
                <Route path="/login" element={<Login />} />

                <Route path="/" element={
                    <PrivateRoute>
                        <Home />
                    </PrivateRoute>
                } />

                <Route path="/admin" element={
                    <PrivateRoute>
                        <AdminRoute>
                            <Admin />
                        </AdminRoute>
                    </PrivateRoute>
                } />

                {/* 🌟 TÁCH RIÊNG DASHBOARD THÀNH MỘT TRANG ĐỘC LẬP */}
                <Route path="/dashboard" element={
                    <PrivateRoute>
                        <AdminRoute>
                            <Dashboard />
                        </AdminRoute>
                    </PrivateRoute>
                } />
            </Routes>
        </BrowserRouter>
    )
}

export default App