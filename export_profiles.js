/**
 * Script trích xuất danh sách profiles và cookies từ dự án upload_tiktok
 * Đóng gói ra file JSON tương thích 100% với tính năng Import của tiktok-at
 * Hỗ trợ chạy trên cả Windows, macOS và Linux.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Tự động xác định đường dẫn thư mục gốc và backend
let rootDir = __dirname;
let backendDir = path.join(rootDir, 'backend');
if (!fs.existsSync(backendDir) && fs.existsSync(path.join(rootDir, 'server.js'))) {
    // Đang chạy bên trong thư mục backend
    backendDir = rootDir;
    rootDir = path.join(__dirname, '..');
}

// Load các thư viện từ node_modules của backend
const req = createRequire(path.join(backendDir, 'package.json'));
let Database;
let chromium;

try {
    Database = req('better-sqlite3');
} catch (e) {
    console.error('❌ Không thể tải thư viện better-sqlite3:', e.message);
    console.error('👉 Vui lòng chạy "npm install" trong thư mục backend trước.');
    process.exit(1);
}

try {
    const pw = req('playwright');
    chromium = pw.chromium;
} catch (e) {
    console.error('❌ Không thể tải thư viện playwright:', e.message);
    console.error('👉 Vui lòng chạy "npm install" trong thư mục backend trước.');
    process.exit(1);
}

// Đường dẫn database & profiles
const dbPath = path.join(rootDir, 'data', 'tiktok.db');
const profilesDir = path.join(rootDir, 'profiles');

function cleanCookie(c) {
    const clean = { ...c };
    if (typeof clean.expires === 'number') {
        clean.expires = Math.round(clean.expires);
    }
    if (clean.sameSite && !['Lax', 'Strict', 'None'].includes(clean.sameSite)) {
        delete clean.sameSite;
    }
    return clean;
}

async function extractCookiesFromDisk(profileName) {
    const userDir = path.join(profilesDir, profileName);
    if (!fs.existsSync(userDir)) return [];

    try {
        const ctx = await chromium.launchPersistentContext(userDir, {
            headless: true,
            args: ['--no-startup-window']
        });
        const cookies = await ctx.cookies();
        await ctx.close();
        return Array.isArray(cookies) ? cookies.map(cleanCookie) : [];
    } catch (err) {
        console.warn(`  ⚠️  Không thể trích xuất cookies từ thư mục "${profileName}": ${err.message}`);
        console.warn(`     (Gợi ý: Hãy tắt toàn bộ cửa sổ Chrome của profile này nếu đang mở)`);
        return [];
    }
}

export async function exportAllProfiles(outputPath) {
    console.log('====================================================');
    console.log('🚀 BẮT ĐẦU TRÍCH XUẤT PROFILES & COOKIES TỪ TOOL CŨ');
    console.log('====================================================\n');

    let profilesFromDb = [];
    const groupMap = new Map();

    if (fs.existsSync(dbPath)) {
        try {
            const db = new Database(dbPath, { readonly: true });
            
            // Lấy danh sách nhóm
            try {
                const groups = db.prepare('SELECT id, name FROM groups').all();
                for (const g of groups) {
                    groupMap.set(g.id, g.name);
                }
            } catch (err) {
                console.warn('⚠️ Không đọc được bảng groups:', err.message);
            }

            // Lấy danh sách profiles
            try {
                profilesFromDb = db.prepare('SELECT * FROM profiles').all();
                console.log(`📦 Tìm thấy ${profilesFromDb.length} profile trong cơ sở dữ liệu SQLite.`);
            } catch (err) {
                console.warn('⚠️ Không đọc được bảng profiles:', err.message);
            }

            db.close();
        } catch (err) {
            console.error('❌ Lỗi kết nối database SQLite:', err.message);
        }
    } else {
        console.warn(`⚠️ Không tìm thấy database tại: ${dbPath}`);
    }

    // Quét thêm các thư mục trong profilesDir nếu chưa có trong DB
    const knownNames = new Set(profilesFromDb.map(p => p.name.toLowerCase()));
    if (fs.existsSync(profilesDir)) {
        const diskEntries = fs.readdirSync(profilesDir, { withFileTypes: true });
        for (const entry of diskEntries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
                if (!knownNames.has(entry.name.toLowerCase())) {
                    console.log(`📁 Tìm thấy profile ngoài database trên ổ đĩa: "${entry.name}"`);
                    profilesFromDb.push({
                        name: entry.name,
                        group_id: null,
                        video_folder: '',
                        schedule_interval: 10,
                        auto_increment_schedule: 1,
                        set_music: 1,
                        remove_title: 1,
                        need_content_check: 0
                    });
                    knownNames.add(entry.name.toLowerCase());
                }
            }
        }
    }

    if (profilesFromDb.length === 0) {
        console.log('❌ Không tìm thấy profile nào để trích xuất!');
        return [];
    }

    console.log(`\n⏳ Đang trích xuất cookies cho ${profilesFromDb.length} profile...`);

    const exportList = [];
    let successCookiesCount = 0;

    for (let i = 0; i < profilesFromDb.length; i++) {
        const p = profilesFromDb[i];
        const groupName = groupMap.get(p.group_id) || '';
        console.log(`[${i + 1}/${profilesFromDb.length}] Đang xử lý profile: "${p.name}" (Nhóm: ${groupName || 'Mặc định'})...`);

        let cookies = [];

        // 1. Thử trích xuất từ thư mục trình duyệt trên ổ đĩa (thường là mới nhất)
        cookies = await extractCookiesFromDisk(p.name);

        // 2. Nếu không lấy được từ ổ đĩa, kiểm tra xem trong database có cookies không
        if (cookies.length === 0 && p.cookies) {
            try {
                if (typeof p.cookies === 'string' && p.cookies.trim()) {
                    const parsed = JSON.parse(p.cookies);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        cookies = parsed.map(cleanCookie);
                        console.log(`  ℹ️  Lấy được ${cookies.length} cookies từ database`);
                    }
                }
            } catch {
                // bỏ qua lỗi parse json
            }
        }

        const ttCookies = cookies.filter(c => c.domain && c.domain.includes('tiktok.com'));
        const hasSession = cookies.some(c => c.name === 'sessionid');

        if (cookies.length > 0) {
            successCookiesCount++;
            console.log(`  ✅ Thành công: ${cookies.length} cookies (TikTok: ${ttCookies.length})${hasSession ? ' [ĐÃ ĐĂNG NHẬP SESSION]' : ''}`);
        } else {
            console.log(`  ⚪ Không có cookies (profile chưa đăng nhập hoặc chưa mở trình duyệt)`);
        }

        exportList.push({
            name: p.name,
            group: groupName,
            cookies: cookies,
            video_folder: p.video_folder || '',
            schedule_interval: Number(p.schedule_interval) || 10,
            auto_increment_schedule: p.auto_increment_schedule !== undefined ? (p.auto_increment_schedule ? 1 : 0) : 1,
            set_music: p.set_music !== undefined ? (p.set_music ? 1 : 0) : 1,
            remove_title: p.remove_title !== undefined ? (p.remove_title ? 1 : 0) : 1,
            need_content_check: p.need_content_check !== undefined ? (p.need_content_check ? 1 : 0) : 0
        });
    }

    // Ghi ra file JSON
    const targetFile = outputPath || path.join(rootDir, 'xuat_profiles_tiktok.json');
    fs.writeFileSync(targetFile, JSON.stringify(exportList, null, 2), 'utf-8');

    console.log('\n====================================================');
    console.log('🎉 XUẤT THÀNH CÔNG!');
    console.log(`📊 Tổng số profile: ${exportList.length}`);
    console.log(`🔑 Số profile có cookies: ${successCookiesCount}/${exportList.length}`);
    console.log(`📁 File đã lưu tại:`);
    console.log(`👉 ${targetFile}`);
    console.log('====================================================');
    console.log('\n📖 HƯỚNG DẪN IMPORT SANG DỰ ÁN MỚI (tiktok-at):');
    console.log('1. Mở dự án tiktok-at lên (giao diện web).');
    console.log('2. Tại thanh công cụ danh sách Profiles, nhấn nút "Nhập Cookies từ file JSON" (biểu tượng file JSON).');
    console.log(`3. Chọn file vừa tạo: "${path.basename(targetFile)}"`);
    console.log('4. Hệ thống sẽ tự động tạo các nhóm, profile và nạp session TikTok tương ứng!\n');

    return exportList;
}

// Nếu chạy trực tiếp từ dòng lệnh
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('export_profiles.js'))) {
    const customOutput = process.argv[2] || null;
    exportAllProfiles(customOutput)
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n❌ Có lỗi xảy ra trong quá trình xuất:', err);
            process.exit(1);
        });
}
