require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const XLSX = require('xlsx');

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

pool.query("SELECT NOW()", (err, result) => {
    if (err) {
        console.error("데이터베이스 연결 실패:", err);
    } else {
        console.log("데이터베이스 연결 성공:", result.rows[0]);
    }
});

// 미들웨어
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: false, // http라 false
    }
}));
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
// admin 권한 검사
function checkAdmin(req, res, next) {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    if (req.session.role !== 'admin') {
        return res.status(403).json({ error: "관리자 권한이 필요합니다." });
    }
    next();
}

// 관리자 활동 로그 저장 함수
async function logAdminAction(adminUsername, actionType, target) {
    const username = adminUsername || 'Admin';
    try {
        await pool.query(
            "INSERT INTO admin_logs (admin_username, action_type, target) VALUES ($1, $2, $3)",
            [username, actionType, target]
        );
    } catch (err) {
        console.error("관리자 로그 저장 실패:", err);
    }
}
// 관리자 로그 조회 API (페이지네이션 적용: 페이지당 25건)
app.get("/api/admin/logs", checkAdmin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 25;
    const offset = (page - 1) * limit;

    try {
        // 전체 로그 개수 조회
        const countResult = await pool.query("SELECT COUNT(*) FROM admin_logs");
        const totalCount = parseInt(countResult.rows[0].count);
        const totalPages = Math.ceil(totalCount / limit) || 1;

        // 해당 페이지 25건 조회
        const logResult = await pool.query(
            "SELECT * FROM admin_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2",
            [limit, offset]
        );

        res.json({
            success: true,
            data: logResult.rows,
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalCount: totalCount
            }
        });
    } catch (err) {
        console.error("관리자 로그 조회 에러:", err);
        res.status(500).json({ error: "로그 조회 실패" });
    }
});

// 로그인 유저 정보 및 권한 조회 API (버튼 노출)
app.get("/api/me", (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    res.json({
        username: req.session.user,
        role: req.session.role || 'user'
    });
});

// 메인 페이지 (이미 로그인된 세션이 있다면 대시보드로 자동 이동)
app.get("/", (req, res) => {
    if (req.session && req.session.user) {
        return res.redirect("/dashboard");
    }
    res.sendFile(__dirname + "/public/index.html");
});

// 회원가입 라우트 (모달 API 방식 - 모든 if문 중괄호 필수 적용)
app.post("/signup", async (req, res) => {
    const id = req.body.id?.trim();
    const password = req.body.password?.trim();
    const confirmpassword = req.body.confirmpassword?.trim();

    if (!id) {
        return res.status(400).json({ error: "아이디를 입력해주세요." });
    }
    if (!password) {
        return res.status(400).json({ error: "비밀번호를 입력해주세요." });
    }
    if (!confirmpassword) {
        return res.status(400).json({ error: "비밀번호 확인을 입력해주세요." });
    }
    if (password !== confirmpassword) {
        return res.status(400).json({ error: "비밀번호가 일치하지 않습니다." });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (username, password) VALUES ($1, $2)",
            [id, hashedPassword]
        );
        res.json({ success: true, message: "회원가입이 완료되었습니다!" });
    } catch (err) {
        console.error(err);
        if (err.code === "23505") {
            return res.status(400).json({ error: "이미 존재하는 아이디입니다." });
        }
        return res.status(500).json({ error: "회원가입 처리 중 오류가 발생했습니다." });
    }
});

// 로그인 라우트 (모달 API 방식 - JSON 응답)
app.post("/login", async (req, res) => {
    const id = req.body.id?.trim();
    const password = req.body.password?.trim();

    if (!id) {
        return res.status(400).json({ error: "아이디를 입력해주세요." });
    }
    if (!password) {
        return res.status(400).json({ error: "비밀번호를 입력해주세요." });
    }

    try {
        const result = await pool.query(
            "SELECT * FROM users WHERE username = $1",
            [id]
        );

        const user = result.rows[0];

        if (!user) {
            return res.status(400).json({ error: "존재하지 않는 아이디입니다." });
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
            return res.status(400).json({ error: "비밀번호가 일치하지 않습니다." });
        }

        req.session.user = user.username;
        req.session.role = user.role || 'user'; // admin / user 구분

        res.json({ success: true, message: "로그인 성공!" });
    } catch (err) {
        console.error("로그인 에러:", err);
        res.status(500).json({ error: "로그인 처리 중 오류가 발생했습니다." });
    }
});

// 대시보드 라우트
app.get("/dashboard", async (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    res.sendFile(__dirname + "/views/dashboard.html");
});

// 로그아웃 라우트
app.get("/logout", (req, res) => {
    req.session.destroy(() => {
        res.redirect("/");
    });
});

// 비밀번호 변경 API
app.post("/api/change-password", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { currentPassword, newPassword, confirmPassword } = req.body;
    const username = req.session.user;

    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "모든 항목을 입력해 주세요." });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "새 비밀번호가 서로 일치하지 않습니다." });
    }

    if (newPassword.length < 4) {
        return res.status(400).json({ error: "비밀번호는 최소 4자리 이상이어야 합니다." });
    }

    try {
        // 현재 유저 정보 조회
        const userRes = await pool.query("SELECT * FROM users WHERE username = $1", [username]);
        const user = userRes.rows[0];

        if (!user) {
            return res.status(404).json({ error: "사용자 정보를 찾을 수 없습니다." });
        }

        // 현재 비밀번호 일치 여부 검증
        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: "현재 비밀번호가 일치하지 않습니다." });
        }

        // 새 비밀번호 해시화 및 DB 업데이트
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);
        await pool.query(
            "UPDATE users SET password = $1 WHERE username = $2",
            [hashedNewPassword, username]
        );

        res.json({ success: true, message: "비밀번호가 성공적으로 변경되었습니다!" });
    } catch (err) {
        console.error("비밀번호 변경 에러:", err);
        res.status(500).json({ error: "비밀번호 변경 처리 중 오류가 발생했습니다." });
    }
});

// 지점 목록 조회 API
app.get("/api/locations", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }
    try {
        const result = await pool.query("SELECT * FROM locations ORDER BY id ASC");
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "지점 조회 실패" });
    }
});

// 지점별 페이지 라우트
app.get("/location/:locationName", (req, res) => {
    if (!req.session.user) {
        return res.redirect("/");
    }
    res.sendFile(__dirname + "/views/location.html");
});

// IDC, 카테고리 별 자산목록 및 재고수량 조회 API
app.get("/api/assets/:location/:category", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { location, category } = req.params;

    try {
        const query = `
        SELECT
            i.id AS item_id,
            i.category,
            i.vendor,
            i.spec,
            COALESCE(s.quantity, 0) AS quantity,
            s.updated_at
        FROM items i
        LEFT JOIN stock s
            ON i.id = s.item_id
            AND s.location_id = (SELECT id FROM locations WHERE name = $1)
        WHERE i.category = $2
        ORDER BY i.vendor, i.id;
    `;

        const result = await pool.query(query, [location, category]);

        res.json({
            success: true,
            location: location,
            category: category,
            data: result.rows
        });

    } catch (err) {
        console.error("자산 데이터 조회 에러:", err);
        res.status(500).json({ error: "자산 데이터 조회 실패" });
    }
});

// 자산 품목 추가 API (관리자 전용)
app.post("/api/items", checkAdmin, async (req, res) => {
    const { category, vendor, spec } = req.body;

    if (!category || !vendor || !spec) {
        return res.status(400).json({ error: "모든 항목을 입력해 주세요." });
    }

    try {
        const checkExist = await pool.query(
            "SELECT id FROM items WHERE category = $1 AND vendor = $2 AND spec = $3",
            [category.trim(), vendor.trim(), spec.trim()]
        );

        if (checkExist.rows.length > 0) {
            return res.status(400).json({ error: "이미 동일한 자산 품목이 존재합니다." });
        }
        
        const result = await pool.query(
            "INSERT INTO items (category, vendor, spec) VALUES ($1, $2, $3) RETURNING *",
            [category.trim(), vendor.trim(), spec.trim()]
        );
        await logAdminAction(req.session.user, '자산 추가', `${category} - ${vendor} (${spec})`);
        res.json({ success: true, message: "신규 자산이 등록되었습니다.", item: result.rows[0] });
    } catch (err) {
        console.error("자산 등록 에러", err);
        res.status(500).json({ error: "자산 등록 실패" });
    }
});

// 자산 품목 삭제 API (관리자 전용)
app.delete("/api/items/:itemId", checkAdmin, async (req, res) => {
    const { itemId } = req.params;
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 🌟 [추가] 삭제하기 전에 대상 자산 정보(카테고리, 제조사, 스펙)를 먼저 읽어옴!
        const itemRes = await client.query("SELECT category, vendor, spec FROM items WHERE id = $1", [itemId]);
        let itemDetail = `Item ID: ${itemId}`;
        if (itemRes.rows.length > 0) {
            const { category, vendor, spec } = itemRes.rows[0];
            itemDetail = `${category} - ${vendor} (${spec})`;
        }

        // 관련 재고 및 로그 삭제 후 items 삭제
        await client.query("DELETE FROM stock_logs WHERE item_id = $1", [itemId]);
        await client.query("DELETE FROM stock WHERE item_id = $1", [itemId]);
        await client.query("DELETE FROM items WHERE id = $1", [itemId]);

        await client.query('COMMIT');

        // 🌟 [수정] ID 대신 조회해둔 명확한 자산 스펙으로 로그 남기기!
        await logAdminAction(req.session.user, '자산 삭제', itemDetail);

        res.json({ success: true, message: "자산이 삭제되었습니다." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("자산 삭제 에러:", err);
        res.status(500).json({ error: "자산 삭제 실패" });
    } finally {
        client.release();
    }
});

// 수량 변경 (입출고 및 이전) API
app.post("/api/stock/update", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { location, itemId, type, changeQty, requester, targetLocation } = req.body;
    const updatedBy = req.session.user;
    const numChange = parseInt(changeQty, 10);

    if (isNaN(numChange) || numChange <= 0) {
        return res.status(400).json({ error: "올바른 수량을 입력해주세요." });
    }

    const formattedRequester = (requester && typeof requester === 'string' && requester.trim())
        ? requester.trim()
        : '미기재';

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // 출발지 IDC ID 조회
        const locRes = await client.query("SELECT id FROM locations WHERE name = $1", [location]);
        if (locRes.rows.length === 0) {
            throw new Error("존재하지 않는 IDC입니다.");
        }
        const locationId = locRes.rows[0].id;

        // 출발지 현재 재고 조회
        const stockRes = await client.query(
            "SELECT quantity FROM stock WHERE location_id = $1 AND item_id = $2 FOR UPDATE",
            [locationId, itemId]
        );

        let currentQty = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;

        if (type === "사용") {
            let newQty = currentQty - numChange;
            if (newQty < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `재고가 부족합니다. (현재 재고: ${currentQty}개)` });
            }

            await client.query(`
                INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_by = EXCLUDED.updated_by, updated_at = NOW();
            `, [locationId, itemId, newQty, updatedBy]);

            await client.query(`
                INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by, requester)
                VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, [locationId, itemId, type, numChange, newQty, updatedBy, formattedRequester]);

        } else if (type === "반납") {
            let newQty = currentQty + numChange;

            await client.query(`
                INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_by = EXCLUDED.updated_by, updated_at = NOW();
            `, [locationId, itemId, newQty, updatedBy]);

            await client.query(`
                INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by, requester)
                VALUES ($1, $2, $3, $4, $5, $6, $7);
            `, [locationId, itemId, type, numChange, newQty, updatedBy, formattedRequester]);

        } else if (type === "이전") {
            if (!targetLocation || targetLocation === location) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: "올바른 이전 대상 IDC를 선택해주세요." });
            }

            // 출발지 재고 부족 확인
            let sourceNewQty = currentQty - numChange;
            if (sourceNewQty < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `출발지 IDC 재고가 부족합니다. (현재 재고: ${currentQty}개)` });
            }

            // 목적지 IDC ID 및 현재 재고 조회
            const targetLocRes = await client.query("SELECT id FROM locations WHERE name = $1", [targetLocation]);
            if (targetLocRes.rows.length === 0) throw new Error("존재하지 않는 목적지 IDC입니다.");
            const targetLocationId = targetLocRes.rows[0].id;

            const targetStockRes = await client.query(
                "SELECT quantity FROM stock WHERE location_id = $1 AND item_id = $2",
                [targetLocationId, itemId]
            );
            let targetCurrentQty = targetStockRes.rows.length > 0 ? targetStockRes.rows[0].quantity : 0;
            let targetNewQty = targetCurrentQty + numChange;

            // 1) 출발지 IDC: 차감 및 '이전(출고)' 이력 저장
            await client.query(`
                INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_by = EXCLUDED.updated_by, updated_at = NOW();
            `, [locationId, itemId, sourceNewQty, updatedBy]);

            await client.query(`
                INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by, requester)
                VALUES ($1, $2, '이전(출고)', $3, $4, $5, $6);
            `, [locationId, itemId, numChange, sourceNewQty, updatedBy, `${formattedRequester} (${targetLocation}으로 이동)`]);

            // 2) 목적지 IDC: 증가 및 '이전(입고)' 이력 저장
            await client.query(`
                INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
                VALUES ($1, $2, $3, $4, NOW())
                ON CONFLICT (item_id, location_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_by = EXCLUDED.updated_by, updated_at = NOW();
            `, [targetLocationId, itemId, targetNewQty, updatedBy]);

            await client.query(`
                INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by, requester)
                VALUES ($1, $2, '이전(입고)', $3, $4, $5, $6);
            `, [targetLocationId, itemId, numChange, targetNewQty, updatedBy, `${formattedRequester} (${location}에서 이동)`]);

        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "올바른 구분을 선택해주세요." });
        }

        await client.query('COMMIT');
        res.json({ success: true, message: "처리가 완료되었습니다." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("입출고 처리 에러:", err);
        res.status(500).json({ error: "수량 수정 실패" });
    } finally {
        client.release();
    }
});

// 대시보드 지점별 총 재고 수량 조회 API
app.get("/api/dashboard/stats", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    try {
        const query = `
            SELECT
                l.id,
                l.name AS location_name,
                COALESCE(SUM(s.quantity), 0) AS total_quantity
            FROM locations l
            LEFT JOIN stock s ON l.id = s.location_id
            GROUP BY l.id, l.name
            ORDER BY l.id;
        `;

        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("대시보드 통계 조회 에러:", err);
        res.status(500).json({ error: "통계 데이터 조회 실패" });
    }
});

// IDC 별 입출고 이력 조회 API
app.get("/api/history/:locationName", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { locationName } = req.params;

    try {
        const query = `
            SELECT
                i.category, i.vendor, i.spec,
                sl.type, 
                sl.change_qty, 
                sl.result_qty, 
                sl.updated_by, 
                sl.requester,
                sl.created_at AS updated_at
            FROM stock_logs sl
            JOIN items i ON sl.item_id = i.id
            JOIN locations l ON sl.location_id = l.id
            WHERE l.name = $1 AND sl.type IN ('사용', '반납', '이전(출고)', '이전(입고)')
            ORDER BY sl.created_at DESC
            LIMIT 25;
        `;
        const result = await pool.query(query, [locationName]);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("지점 이력 조회 에러:", err);
        res.status(500).json({ error: "지점 이력 조회 실패" });
    }
});

// 월간 실사 현황 조회 API
app.get("/api/inspections/status", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
        const query = `
            SELECT 
                l.id AS location_id,
                l.name AS location_name,
                COALESCE(mi.is_completed, false) AS is_completed,
                mi.completed_by,
                mi.completed_at,
                mi.canceled_by,
                mi.canceled_at
            FROM locations l
            LEFT JOIN monthly_inspections mi 
                ON l.id = mi.location_id AND mi.year_month = $1
            ORDER BY l.id ASC;
        `;
        const result = await pool.query(query, [currentYearMonth]);
        res.json({ success: true, yearMonth: currentYearMonth, data: result.rows });
    } catch (err) {
        console.error("실사 현황 조회 에러:", err);
        res.status(500).json({ error: "실사 현황 조회 실패" });
    }
});

// 월간 실사 완료 / 취소 토글 API
app.post("/api/inspections/toggle", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { locationId, isCompleted } = req.body;
    const completedBy = req.session.user;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
        const query = `
            INSERT INTO monthly_inspections (
                year_month, location_id, is_completed, 
                completed_by, completed_at, 
                canceled_by, canceled_at
            )
            VALUES (
                $1, $2, $3, 
                CASE WHEN $3 = true THEN $4 ELSE NULL END, 
                CASE WHEN $3 = true THEN NOW() ELSE NULL END,
                CASE WHEN $3 = false THEN $4 ELSE NULL END,
                CASE WHEN $3 = false THEN NOW() ELSE NULL END
            )
            ON CONFLICT (year_month, location_id)
            DO UPDATE SET
                is_completed = EXCLUDED.is_completed,
                completed_by = CASE WHEN EXCLUDED.is_completed = true THEN $4 ELSE NULL END,
                completed_at = CASE WHEN EXCLUDED.is_completed = true THEN NOW() ELSE NULL END,
                canceled_by  = CASE WHEN EXCLUDED.is_completed = false THEN $4 ELSE monthly_inspections.canceled_by END,
                canceled_at  = CASE WHEN EXCLUDED.is_completed = false THEN NOW() ELSE monthly_inspections.canceled_at END;
        `;
        await pool.query(query, [currentYearMonth, locationId, isCompleted, completedBy]);
        res.json({ success: true });
    } catch (err) {
        console.error("실사 상태 변경 에러:", err);
        res.status(500).json({ error: "실사 상태 변경 실패" });
    }
});

// 일괄 자산실사 저장 및 완료 API
app.post("/api/inspections/batch-update", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { locationName, items } = req.body;
    const updatedBy = req.session.user;
    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const locRes = await client.query("SELECT id FROM locations WHERE name = $1", [locationName]);
        if (locRes.rows.length === 0) {
            throw new Error("존재하지 않는 IDC입니다.");
        }
        const locationId = locRes.rows[0].id;

        for (const item of items) {
            const numNewQty = parseInt(item.newQty, 10);
            const numCurrQty = parseInt(item.currentQty, 10);

            if (isNaN(numNewQty) || numNewQty < 0) {
                continue;
            }

            if (numNewQty !== numCurrQty) {
                const changeQty = Math.abs(numNewQty - numCurrQty);

                await client.query(`
                    INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
                    VALUES ($1, $2, $3, $4, NOW())
                    ON CONFLICT (item_id, location_id)
                    DO UPDATE SET
                        quantity = EXCLUDED.quantity,
                        updated_by = EXCLUDED.updated_by,
                        updated_at = NOW();
                `, [locationId, item.itemId, numNewQty, updatedBy]);

                await client.query(`
                    INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by)
                    VALUES ($1, $2, '실사', $3, $4, $5);
                `, [locationId, item.itemId, changeQty, numNewQty, updatedBy]);
            }
        }

        await client.query(`
            INSERT INTO monthly_inspections (year_month, location_id, is_completed, completed_by, completed_at)
            VALUES ($1, $2, true, $3, NOW())
            ON CONFLICT (year_month, location_id)
            DO UPDATE SET
                is_completed = true,
                completed_by = $3,
                completed_at = NOW();
        `, [currentYearMonth, locationId, updatedBy]);

        await client.query('COMMIT');
        res.json({ success: true, message: "월간 실사가 완료되었습니다." });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("일괄 실사 처리 에러:", err);
        res.status(500).json({ error: "실사 저장 실패" });
    } finally {
        client.release();
    }
});

// 🌟 이번 달 전체 지점 월간 실사 결과 엑셀 다운로드 API
app.get("/api/inspections/export-excel", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const now = new Date();
    const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    try {
        // 모든 지점의 모든 자산 품목과 현재 재고 및 최근 업데이트 일시 조회
        const query = `
            SELECT
                l.name AS location_name,
                i.category,
                i.vendor,
                i.spec,
                COALESCE(s.quantity, 0) AS quantity,
                s.updated_by,
                s.updated_at
            FROM locations l
            CROSS JOIN items i
            LEFT JOIN stock s ON l.id = s.location_id AND i.id = s.item_id
            ORDER BY l.id ASC, i.category ASC, i.vendor ASC, i.id ASC;
        `;

        const result = await pool.query(query);

        // 엑셀에 들어갈 데이터 가공
        const excelData = result.rows.map(row => {
            const dateStr = row.updated_at ? new Date(row.updated_at).toLocaleString('ko-KR') : '기록 없음';
            return {
                "IDC 센터": row.location_name,
                "카테고리": row.category,
                "제조사(Vendor)": row.vendor,
                "품명 및 스펙": row.spec,
                "실사 수량": row.quantity,
                "최종 수정자": row.updated_by || '-',
                "최종 수정일시": dateStr
            };
        });

        // 엑셀 워크북 생성
        const worksheet = XLSX.utils.json_to_sheet(excelData);

        // 열 너비 예쁘게 자동 조정
        worksheet['!cols'] = [
            { wch: 12 }, // IDC 센터
            { wch: 15 }, // 카테고리
            { wch: 18 }, // 제조사
            { wch: 30 }, // 스펙
            { wch: 12 }, // 수량
            { wch: 15 }, // 최종 수정자
            { wch: 22 }  // 최종 수정일시
        ];

        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, `${currentYearMonth} 실사현황`);

        // 버퍼 생성 및 응답 파일 전송
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        const fileName = encodeURIComponent(`DC_Asset_Inspection_${currentYearMonth}.xlsx`);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"; filename*=UTF-8''${fileName}`);
        res.send(buffer);

    } catch (err) {
        console.error("엑셀 출력 에러:", err);
        res.status(500).json({ error: "엑셀 다운로드에 실패했습니다." });
    }
});

// 최근 자산 변경 이력 조회
app.get("/api/history", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    try {
        const query = `
            SELECT
                l.name AS location_name,
                i.category,
                i.vendor,
                i.spec,
                sl.type,
                sl.change_qty,
                sl.result_qty,
                sl.updated_by,
                sl.requester,
                sl.created_at AS updated_at
            FROM stock_logs sl
            JOIN items i ON sl.item_id = i.id
            JOIN locations l ON sl.location_id = l.id
            WHERE sl.type IN ('사용', '반납', '이전(출고)', '이전(입고)')
            ORDER BY sl.created_at DESC
            LIMIT 50;
        `;

        const result = await pool.query(query);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("이력 조회 에러:", err);
        res.status(500).json({ error: "이력 조회 실패" });
    }
});

//  전체 이력 검색 API (지점/카테고리/검색어 필터 지원)
app.get("/api/history/search/all", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { location, category, search } = req.query;

    try {
        let query = `
            SELECT
                l.name AS location_name,
                i.category,
                i.vendor,
                i.spec,
                sl.type,
                sl.change_qty,
                sl.result_qty,
                sl.updated_by,
                sl.requester,
                sl.created_at AS updated_at
            FROM stock_logs sl
            JOIN items i ON sl.item_id = i.id
            JOIN locations l ON sl.location_id = l.id
            WHERE sl.type IN ('사용', '반납', '이전(출고)', '이전(입고)') 
        `;

        const params = [];

        // 1) 지점 필터
        if (location && location !== 'ALL') {
            params.push(location);
            query += ` AND l.name = $${params.length}`;
        }

        // 2) 카테고리 필터
        if (category && category !== 'ALL') {
            params.push(category);
            query += ` AND i.category = $${params.length}`;
        }

        // 3) 스펙/제조사 검색어 필터
        if (search && search.trim() !== '') {
            params.push(`%${search.trim()}%`);
            query += ` AND (i.spec ILIKE $${params.length} OR i.vendor ILIKE $${params.length})`;
        }

        query += ` ORDER BY sl.created_at DESC LIMIT 500;`; // 최대 500건까지 조회

        const result = await pool.query(query, params);
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error("전체 이력 검색 에러:", err);
        res.status(500).json({ error: "전체 이력 조회 실패" });
    }
});

// 서버 시작
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});