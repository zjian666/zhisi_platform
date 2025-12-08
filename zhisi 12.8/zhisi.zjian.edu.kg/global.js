// global.js - 核心逻辑 (请确保文件名正确)

// ！！！注意：请将下方 IP 换成你服务器的公网 IP 或域名 ！！！
// 如果你已配置域名，请使用 http://zhisi.zjian.edu.kg:3000
const API_BASE_URL = 'https://api.zhisi.zjian.edu.kg/api'; 

document.addEventListener('DOMContentLoaded', function() {
    checkPermission();
    injectUserInfoBar();
});

// 1. 获取当前用户
function getCurrentUser() {
    const userStr = localStorage.getItem('zhisi_current_user');
    return userStr ? JSON.parse(userStr) : null;
}

// 2. 权限拦截逻辑
function checkPermission() {
    const user = getCurrentUser();
    const path = window.location.pathname;
    const page = path.split('/').pop(); 

    // 不需要登录就能看的页面
    const publicPages = ['index.html', 'login.html', '']; 

    // 如果未登录，且访问了受限页面 -> 踢回登录页
    if (!publicPages.includes(page) && !user) {
        alert('请先登录！');
        window.location.href = 'login.html';
        return;
    }

    // --- 学生限制逻辑 ---
    if (user && user.role === 'student') {
        // 学生只能访问的页面白名单
        const allowedPages = ['index.html', 'login.html', 'my.html', 'resources.html', 'question.html'];
        
        if (!allowedPages.includes(page)) {
            alert('权限不足：学生身份无法访问教研板块。');
            window.location.href = 'index.html';
        }
    }
}

// 3. 顶部插入用户信息栏
function injectUserInfoBar() {
    const user = getCurrentUser();
    if (!user) return; 

    const bar = document.createElement('div');
    bar.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 35px;
        background: #2c3e50; color: #fff; z-index: 99999;
        display: flex; align-items: center; justify-content: space-between;
        padding: 0 20px; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    `;

    const roleName = user.role === 'teacher' ? '教师' : (user.role === 'student' ? '学生' : '管理员');
    
    bar.innerHTML = `
        <div>
            <span style="color: #e74c3c;">●</span> 
            智思平台 
            <span style="opacity: 0.8; margin-left:10px;">${user.name} (${roleName})</span>
        </div>
        <div>
            <a href="my.html" style="color: white; margin-right: 15px; text-decoration: none;">个人中心</a>
            <span onclick="globalLogout()" style="cursor: pointer; color: #e74c3c;">[退出]</span>
        </div>
    `;

    document.body.prepend(bar);

    // 防止挡住原有的 Header
    const header = document.querySelector('header');
    if (header) {
        header.style.top = '35px';
        document.body.style.paddingTop = '35px';
    }
}

function globalLogout() {
    if(confirm('确定要退出登录吗？')) {
        localStorage.removeItem('zhisi_current_user');
        window.location.href = 'index.html';
    }
}
