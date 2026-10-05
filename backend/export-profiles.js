/**
 * Trích xuất danh sách profiles và cookies từ dự án upload_tiktok
 * Tương thích với tính năng Import của tiktok-at
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

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

export async function exportProfiles({ targetIds = null, outputPath = null } = {}) {
    console.log('====================================================');
    console.log('🚀 BẮT ĐẦU TRÍCH XUẤT PROFILES & COOKIES');
    if (targetIds && targetIds.length > 0) {
        console.log(`🎯 Chỉ định ${targetIds.length} profiles cần xuất`);
    } else {
        console.log('🎯 Chế độ xuất toàn bộ profiles');
    }
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
                const allProfiles = db.prepare('SELECT * FROM profiles').all();
                if (targetIds && targetIds.length > 0) {
                    const targetSet = new Set(targetIds.map(String));
                    profilesFromDb = allProfiles.filter(p => targetSet.has(String(p.id)));
                } else {
                    profilesFromDb = allProfiles;
                }
                console.log(`📦 Tìm thấy ${profilesFromDb.length} profile trong cơ sở dữ liệu SQLite cần trích xuất.`);
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

    // Quét thêm các thư mục trong profilesDir nếu chưa có trong DB (chỉ khi không chỉ định targetIds)
    if (!targetIds || targetIds.length === 0) {
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
    }

    if (profilesFromDb.length === 0) {
        console.log('❌ Không tìm thấy profile nào phù hợp để trích xuất!');
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

    // Ghi ra file JSON nếu có chỉ định outputPath
    if (outputPath) {
        fs.writeFileSync(outputPath, JSON.stringify(exportList, null, 2), 'utf-8');
        console.log(`📁 File đã lưu tại: ${outputPath}`);
    }

    console.log('\n====================================================');
    console.log('🎉 XUẤT THÀNH CÔNG!');
    console.log(`📊 Tổng số profile đã xuất: ${exportList.length}`);
    console.log(`🔑 Số profile có cookies: ${successCookiesCount}/${exportList.length}`);
    console.log('====================================================\n');

    return exportList;
}

// Alias để tương thích
export async function exportAllProfiles(outputPath, targetIds = null) {
    if (typeof outputPath === 'object' && outputPath !== null) {
        return exportProfiles(outputPath);
    }
    return exportProfiles({ outputPath, targetIds });
}

// Chạy trực tiếp từ dòng lệnh
if (process.argv[1] && (process.argv[1] === __filename || process.argv[1].endsWith('export-profiles.js'))) {
    const customOutput = process.argv[2] || path.join(rootDir, 'xuat_profiles_tiktok.json');
    exportProfiles({ outputPath: customOutput })
        .then(() => process.exit(0))
        .catch(err => {
            console.error('\n❌ Có lỗi xảy ra trong quá trình xuất:', err);
            process.exit(1);
        });
}
