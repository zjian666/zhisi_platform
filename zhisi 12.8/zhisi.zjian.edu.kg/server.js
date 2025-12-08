// server.js - 后端核心代码
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// --- 配置区 ---
const ENCRYPTION_SEED = '1wqqW1781ERq09'; // 你的加密种子
const DB_PATH = '/www/wwwroot/zhisi.zjian.edu.kg/database/info'; // 数据库路径

// --- 连接 SQLite 数据库 ---
const db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
        console.error('数据库连接失败:', err.message);
    } else {
        console.log('已连接到 SQLite 数据库:', DB_PATH);
        initDb(); // 连接成功后初始化表
    }
});

// --- 初始化表结构 & 创建默认管理员 ---
function initDb() {
    db.serialize(() => {
        // 创建用户表
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            phone TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL,
            name TEXT DEFAULT '未命名用户',
            school TEXT,
            region TEXT,
            grade TEXT,
            is_setup INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // 检查并自动创建管理员账号 (如果不存在)
        const adminPhone = 'admin';
        const adminPass = encryptPassword('zhisi040718');
        
        db.get("SELECT * FROM users WHERE phone = ?", [adminPhone], (err, row) => {
            if (!row) {
                const stmt = db.prepare("INSERT INTO users (phone, password, role, name, is_setup) VALUES (?, ?, ?, ?, ?)");
                stmt.run(adminPhone, adminPass, 'admin', '系统管理员', 1);
                stmt.finalize();
                console.log("管理员账号(admin)已自动创建");
            }
        });
    });
}

// --- 加密函数 ---
function encryptPassword(password) {
    return crypto.createHmac('sha256', ENCRYPTION_SEED).update(password).digest('hex');
}

// --- API 1: 注册 (保持不变) ---
app.post('/api/register', (req, res) => {
    // ...保持原样...
    const { phone, password, role } = req.body;
    if (!phone || !password || password.length < 8) return res.status(400).json({ msg: '参数错误' });

    const hashedPassword = encryptPassword(password);
    const defaultName = role === 'teacher' ? '未命名教师' : '未命名学生';

    const sql = `INSERT INTO users (phone, password, role, name) VALUES (?, ?, ?, ?)`;
    db.run(sql, [phone, hashedPassword, role, defaultName], function(err) {
        if (err) {
            if (err.message.includes('UNIQUE')) return res.status(409).json({ msg: '手机号已存在' });
            return res.status(500).json({ msg: '服务器错误: ' + err.message });
        }
        res.json({ msg: '注册成功', id: this.lastID });
    });
});

// --- API 2: 登录 (保持不变) ---
app.post('/api/login', (req, res) => {
    // ...保持原样...
    const { phone, password } = req.body;
    const hashedPassword = encryptPassword(password);

    const sql = `SELECT * FROM users WHERE phone = ? AND password = ?`;
    db.get(sql, [phone, hashedPassword], (err, row) => {
        if (err) return res.status(500).json({ msg: '服务器错误' });
        if (!row) return res.status(401).json({ msg: '账号或密码错误' });

        const { password, ...user } = row;
        res.json({ msg: '登录成功', user });
    });
});

// --- API 3: 更新个人信息 (保持不变) ---
app.post('/api/update-profile', (req, res) => {
    // ...保持原样...
    const { id, name, school, region, grade } = req.body;
    const sql = `UPDATE users SET name = ?, school = ?, region = ?, grade = ?, is_setup = 1 WHERE id = ?`;
    db.run(sql, [name, school, region, grade, id], function(err) {
        if (err) return res.status(500).json({ msg: '更新失败' });
        res.json({ msg: '更新成功' });
    });
});

// --- API 4: 获取用户列表 (管理员) ---
// 修改：增加了 password 字段的查询（虽然是加密的，但为了逻辑完整），但通常不返回给前端。
// 这里我们保持原样，只查非敏感信息。
app.get('/api/users', (req, res) => {
    db.all("SELECT id, phone, role, name, school, region, grade, is_setup FROM users", [], (err, rows) => {
        if (err) return res.status(500).json({ msg: '获取失败' });
        res.json(rows);
    });
});

// --- API 5: 删除用户 (已修复BUG：禁止删除管理员) ---
app.post('/api/delete-user', (req, res) => {
    const { id } = req.body;
    
    // 1. 先查一下这个用户是谁
    db.get("SELECT role FROM users WHERE id = ?", [id], (err, row) => {
        if(err || !row) return res.status(404).json({msg: '用户不存在'});
        
        // 2. 核心逻辑：如果是 admin，拒绝删除
        if(row.role === 'admin') {
            return res.status(403).json({ msg: '安全警告：无法删除管理员账号！' });
        }

        // 3. 执行删除
        db.run("DELETE FROM users WHERE id = ?", [id], function(err) {
            if (err) return res.status(500).json({ msg: '删除失败' });
            res.json({ msg: '删除成功' });
        });
    });
});

// --- API 6 (新增): 管理员编辑用户信息 ---
app.post('/api/admin/edit-user', (req, res) => {
    const { id, name, school, region, grade, phone } = req.body;
    // 简单校验
    if(!id) return res.status(400).json({msg: 'ID缺失'});

    const sql = `UPDATE users SET name=?, school=?, region=?, grade=?, phone=? WHERE id=?`;
    db.run(sql, [name, school, region, grade, phone, id], function(err){
        if(err) return res.status(500).json({msg: '修改失败'});
        res.json({msg: '修改成功'});
    });
});

// --- API 7 (新增): 管理员重置密码 ---
app.post('/api/admin/reset-pass', (req, res) => {
    const { id } = req.body;
    const defaultPass = encryptPassword('12345678'); // 默认密码
    
    db.run("UPDATE users SET password = ? WHERE id = ?", [defaultPass, id], function(err){
        if(err) return res.status(500).json({msg: '重置失败'});
        res.json({msg: '密码已重置为 12345678'});
    });
});

// 启动服务器
app.listen(3000, () => {
    console.log('后端服务已启动: http://localhost:3000');
});
