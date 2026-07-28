require('dotenv').config();
const express = require('express');
const app = express();
const session = require('express-session');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');

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
        const result = await pool.query(
            "INSERT INTO items (category, vendor, spec) VALUES ($1, $2, $3) RETURNING *",
            [category.trim(), vendor.trim(), spec.trim()]
        );
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
        // 관련 재고 및 로그 삭제 후 items 삭제
        await client.query("DELETE FROM stock_logs WHERE item_id = $1", [itemId]);
        await client.query("DELETE FROM stock WHERE item_id = $1", [itemId]);
        await client.query("DELETE FROM items WHERE id = $1", [itemId]);

        await client.query('COMMIT');
        res.json({ success: true, message: "자산이 삭제되었습니다." });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error("자산 삭제 에러:", err);
        res.status(500).json({ error: "자산 삭제 실패" });
    } finally {
        client.release();
    }
});

// 수량 변경 (입출고) API
app.post("/api/stock/update", async (req, res) => {
    if (!req.session.user) {
        return res.status(401).json({ error: "로그인이 필요합니다." });
    }

    const { location, itemId, type, changeQty } = req.body;
    const updatedBy = req.session.user;
    const numChange = parseInt(changeQty, 10);

    if (isNaN(numChange) || numChange <= 0) {
        return res.status(400).json({ error: "올바른 수량을 입력해주세요." });
    }

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const locRes = await client.query("SELECT id FROM locations WHERE name = $1", [location]);
        if (locRes.rows.length === 0) {
            throw new Error("존재하지 않는 IDC입니다.");
        }
        const locationId = locRes.rows[0].id;

        const stockRes = await client.query(
            "SELECT quantity FROM stock WHERE location_id = $1 AND item_id = $2",
            [locationId, itemId]
        );

        let currentQty = stockRes.rows.length > 0 ? stockRes.rows[0].quantity : 0;
        let newQty = currentQty;

        if (type === "사용") {
            newQty = currentQty - numChange;
            if (newQty < 0) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: `재고가 부족합니다. (현재 재고: ${currentQty}개)` });
            }
        } else if (type === "반납") {
            newQty = currentQty + numChange;
        } else {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: "올바른 구분을 선택해주세요." });
        }

        await client.query(`
            INSERT INTO stock (location_id, item_id, quantity, updated_by, updated_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (item_id, location_id)
            DO UPDATE SET
                quantity = EXCLUDED.quantity,
                updated_by = EXCLUDED.updated_by,
                updated_at = NOW();
        `, [locationId, itemId, newQty, updatedBy]);

        await client.query(`
            INSERT INTO stock_logs (location_id, item_id, type, change_qty, result_qty, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6);
        `, [locationId, itemId, type, numChange, newQty, updatedBy]);

        await client.query('COMMIT');
        res.json({ success: true, message: "입출고 처리가 완료되었습니다." });

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
                sl.type, sl.change_qty, sl.result_qty, sl.updated_by,
                sl.created_at AS updated_at
            FROM stock_logs sl
            JOIN items i ON sl.item_id = i.id
            JOIN locations l ON sl.location_id = l.id
            WHERE l.name = $1 AND sl.type IN ('사용', '반납')
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
                mi.completed_at
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
            INSERT INTO monthly_inspections (year_month, location_id, is_completed, completed_by, completed_at)
            VALUES ($1, $2, $3, $4, NOW())
            ON CONFLICT (year_month, location_id)
            DO UPDATE SET
                is_completed = EXCLUDED.is_completed,
                completed_by = CASE WHEN EXCLUDED.is_completed THEN $4 ELSE NULL END,
                completed_at = CASE WHEN EXCLUDED.is_completed THEN NOW() ELSE NULL END;
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
                sl.created_at AS updated_at
            FROM stock_logs sl
            JOIN items i ON sl.item_id = i.id
            JOIN locations l ON sl.location_id = l.id
            WHERE sl.type IN ('사용', '반납')
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

// 서버 시작
app.listen(3000, () => {
    console.log("Server is running on port 3000");
});