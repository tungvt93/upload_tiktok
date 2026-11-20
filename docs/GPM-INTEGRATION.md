# Tích hợp core GPM Login vào tool — những gì đã sửa

Ngày: 2026-11-15 · Nhánh: `feature/patchright-engine` · Trạng thái: **chưa commit**

Tài liệu này mô tả toàn bộ thay đổi khi cho phép một profile của tool chạy trên
**Chromium core của GPM Login** (`gpm_browser_chromium_core_NNN`) để fingerprint
giống GPM, kèm các phát hiện khi đo đạc và các điểm còn mở.

---

## 1. Mục tiêu và kết luận ngắn

**Mục tiêu:** profile của tool có fingerprint giống hệt profile tạo bằng GPM.

**Phát hiện then chốt:** GPM không giả fingerprint bằng JavaScript như
`fingerprint-injector` của tool. GPM dùng một **Chromium đã vá ở mức C++**, và core
này tự đọc cấu hình từ file:

```
<user-data-dir>/Default/GPMSoft/gpm_fg.dat
```

File là **base64 của JSON** `{ "gpm": { ... } }`. Đã kiểm chứng core đọc file này
**khi chạy độc lập, không cần GPM launcher** (timezone, UA, `jsHeapSizeLimit`, hash
canvas/audio, GPU, screen… đều thay đổi theo file).

**Cách làm:** dùng chính core GPM làm "kernel" cho profile (cơ chế `kernel_path` đã có
sẵn), và để tool tự tạo/cập nhật `gpm_fg.dat` trước khi mở trình duyệt.

**Kết quả đối chiếu với profile GPM đang mở thật:** 78/81 chỉ số trùng khớp. 3 chỉ số
còn lại là giá trị ngẫu nhiên/phụ thuộc cửa sổ (xem mục 7).

---

## 2. Tổng quan thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `backend/gpm-config.js` | **mới** | Sinh, ghi, đọc, kiểm tra `gpm_fg.dat`; áp dữ liệu proxy; cờ khởi chạy GPM |
| `backend/gpm-default-config.json` | **mới** | Mẫu cấu hình (lấy từ profile GPM thật, đã xoá dữ liệu cá nhân) |
| `backend/proxy-geo.js` | **mới** | Tra vị trí IP thoát của proxy, có cache theo profile |
| `backend/browser-launch.js` | sửa | Gọi `prepareGpmKernelProfile` trong `launchProfileBrowser` |
| `backend/kernel-manager.js` | sửa | Nhận diện core GPM đã cài; đọc version từ thư mục con |
| `frontend/src/components/EditProfileModal.jsx` | sửa nhẹ | Dòng hướng dẫn ở mục chọn kernel |
| `backend/tests/gpm-config.test.js` | **mới** | 14 test |
| `backend/tests/proxy-geo.test.js` | **mới** | 2 test |

`backend/server.js` **không bị sửa**: cả 3 chỗ mở trình duyệt (mở thủ công, đổi avatar,
chạy upload) đều đi qua `launchProfileBrowser` nên tự được áp dụng.

---

## 3. Chi tiết từng file

### 3.1 `backend/gpm-default-config.json` (mới)

Mẫu `gpm_fg.dat` đã giải mã từ một profile GPM thật, sau đó **xoá dữ liệu riêng**:
`name`, `license.key`, `license.machineId`, `webRTC.publicIP`, toạ độ `geo_location`,
`timezone`, `overlay_icon.short_title`. Các nhóm còn lại giữ nguyên cấu trúc:

| Nhóm | Mode mặc định trong mẫu |
|---|---|
| `navigator` (`processorCount`, `deviceMemory`, `jsHeapSizeLimit`) | `noise` |
| `audio` | `noise` |
| `canvas` | `real` |
| `webgl` (kèm khối `parameter` với các `MAX_*`) | `real` |
| `webgpu` | `real` |
| `screen`, `font`, `clientRect` | `real` |
| `webRTC` (`stun_server`, `fake_in_1`, `fake_relay`) | `real` |
| `geo_location` | `real` (sau khi có proxy thì thành `fake`) |

Các giá trị mode **hợp lệ** đã xác nhận: `real`, `noise`, `fake`. Giá trị `custom` bị core
**bỏ qua** (quay về mặc định).

### 3.2 `backend/gpm-config.js` (mới)

Các hàm xuất ra:

| Hàm | Việc làm |
|---|---|
| `isGpmKernel(exe)` | `true` nếu cạnh `chrome.exe` có `gpmdriver.exe` hoặc đường dẫn chứa `gpm_browser_chromium_core` |
| `buildGpmConfig(opts)` | Sinh cấu hình mới từ mẫu: căn UA và `brand.version` theo version kernel; sinh **seed riêng cho profile** (`audio.noise` ∈ (−2, 2), `canvas.noiseToken` ngẫu nhiên). Nhận `overrides` (deep-merge), `timezone`, `geo`, `publicIP`, `random` (để test) |
| `encodeGpmConfig` / `decodeGpmConfig` | JSON ⇄ base64, đúng định dạng GPM |
| `readGpmConfig(dir)` / `writeGpmConfig(dir, cfg)` | Đọc/ghi `Default/GPMSoft/gpm_fg.dat` (tự tạo thư mục) |
| `ensureGpmConfig(dir, opts)` | Nếu file **chưa có** thì sinh và ghi; nếu **đã có** thì giữ nguyên (giữ danh tính ổn định) và chỉ cập nhật UA/`brand.version` khi kernel được nâng phiên bản. Trả `{ created, config }` |
| `gpmLaunchArgs(dir)` | Trả các cờ giống GPM launcher: `--lang=<mã ngôn ngữ>`, `--gpm-disable-machine-id`, `--gpm-use-pref-tracking-config-before-v137`. `--lang` lấy từ ngôn ngữ đầu tiên trong `intl.selected_languages` của `Preferences` (vd `vi-VN` → `vi`); profile mới chưa có `Preferences` thì mặc định `en-US` |
| `applyProxyGeo(cfg, geo)` | Ghi `timezone`, `geo_location` (`mode: "fake"` + toạ độ), `webRTC.publicIP`, và **đặt `webRTC.mode = "fake"`**. Trả `true` nếu có thay đổi |
| `validateGpmConfig(cfg, { kernelVersion })` | Báo **lỗi** nếu UA hoặc `brand.version` lệch version kernel, hoặc mode không hợp lệ; báo **cảnh báo** nếu geo `fake` mà thiếu timezone, hoặc WebRTC `fake` mà thiếu `publicIP` |

Quyết định thiết kế quan trọng: cấu hình nằm **trong thư mục profile**, không thêm cột
DB. Nhờ đó profile giữ nguyên seed nhiễu (= cùng danh tính) qua các lần mở và khi sao
chép thư mục profile.

### 3.3 `backend/proxy-geo.js` (mới)

Mục đích: timezone, toạ độ và IP WebRTC của trình duyệt phải **khớp IP mà website thấy**
(IP thoát của proxy).

- `toAxiosProxy(proxy)`: chuyển cấu hình proxy kiểu Playwright sang axios. Chỉ hỗ trợ
  `http`/`https`; **socks bị bỏ qua** (trả `null`).
- `fetchProxyGeo(proxy)`: gọi `http://ip-api.com/json/?fields=status,query,timezone,lat,lon,countryCode`
  **đi qua chính proxy** (nên trả về vị trí của IP thoát, không phải IP máy bạn). Timeout
  8 giây. Mọi lỗi → `null`.
- `resolveProxyGeo(dir, proxy)`: dùng cache `Default/GPMSoft/proxy_geo.json`, khoá là
  `server|username`. Chỉ tra lại khi **đổi proxy**.

Lưu ý riêng tư: đây là một lời gọi ra dịch vụ ngoài (`ip-api.com`), đi qua proxy; nội
dung chỉ là truy vấn IP thoát, không gửi tên profile hay dữ liệu tài khoản.

Mọi thất bại của phần tra vị trí chỉ **cảnh báo** và để nguyên cấu hình — không bao giờ
chặn việc mở trình duyệt.

### 3.4 `backend/browser-launch.js` (sửa)

Thêm `import` từ `gpm-config.js` và `proxy-geo.js`, và hàm mới:

```js
export async function prepareGpmKernelProfile(engine, options, userDataDir, profile, deps = {})
```

Chỉ hoạt động khi `engine === 'kernel'` **và** kernel là core GPM. Thứ tự làm việc:

1. Đọc version kernel, gọi `ensureGpmConfig` (tạo `gpm_fg.dat` nếu chưa có).
2. **Thêm cờ GPM** vào `options.args` bằng `gpmLaunchArgs`.
3. **Đặt `options.viewport = null`** (nếu người gọi không chỉ định) → trình duyệt dùng
   cửa sổ thật, không ép 1280×720 của Playwright (nếu không, `screen`/`innerWidth` lệch GPM).
4. Nếu profile có proxy (`options.proxy`): `resolveProxyGeo` → `applyProxyGeo` → ghi lại
   file khi có thay đổi.
5. `validateGpmConfig` và in lỗi/cảnh báo ra log.
6. Toàn bộ bọc `try/catch`: lỗi ở đây chỉ in cảnh báo, **không chặn upload**.

`launchProfileBrowser` giờ gọi `await prepareGpmKernelProfile(...)` ngay sau
`resolveBrowserEngine`. Hàm này cũng nhận tham số `deps` (để test thay thế hàm tra
vị trí).

Tương tác có sẵn: với profile dùng kernel, `applyProfileFingerprint` trong `server.js`
đã **bỏ qua** lớp inject JS (do commit trước), nên không có hai lớp fingerprint chồng
nhau.

### 3.5 `backend/kernel-manager.js` (sửa)

- Thêm `GPM_CORES_DIR` = `%LOCALAPPDATA%\Programs\GPMLogin\gpm_browser` (đổi được bằng
  biến môi trường `GPM_BROWSER_DIR`).
- `listKernels()` giờ trả thêm các thư mục `gpm_browser_chromium_core_<số>` có
  `chrome.exe` → **dropdown kernel trong UI tự hiện core GPM** (hiện tại: 129, 132, 135, 142).
  Core Firefox bị loại.
- `resolveKernelExecutable()` cho phép chọn core GPM theo **tên thư mục**
  (ví dụ `gpm_browser_chromium_core_142`).
- Chỉ khi dùng thư mục kernel mặc định mới tìm thêm trong thư mục GPM; khi truyền
  `baseDir` tuỳ chỉnh (test) thì giữ cách ly, không đụng tới bản cài thật.
- `readKernelVersion()` đọc thêm version từ **thư mục con** tên `142.0.7444.163/`
  (cấu trúc của GPM). Cách cũ (file `<version>.manifest` cạnh `chrome.exe`) vẫn chạy.

### 3.6 `frontend/src/components/EditProfileModal.jsx`

Chỉ sửa **dòng hướng dẫn** dưới ô chọn kernel, thêm câu nói có thể chọn core GPM. Ô chọn
kernel đã có từ commit trước và lấy danh sách từ `/api/kernels`, nên không cần thêm UI.

---

## 4. Luồng chạy sau khi tích hợp

```
UI chọn kernel = gpm_browser_chromium_core_142
        │
        ▼
launchProfileBrowser(userDataDir, profile, options)
        │  resolveBrowserEngine → engine = 'kernel', executablePath = ...\chrome.exe
        ▼
prepareGpmKernelProfile
   ├─ ensureGpmConfig        → tạo Default/GPMSoft/gpm_fg.dat nếu chưa có
   ├─ options.args += --lang, --gpm-*      ; options.viewport = null
   ├─ có proxy? resolveProxyGeo (cache proxy_geo.json)
   │            └─ applyProxyGeo → timezone, geo, WebRTC fake + publicIP
   └─ validateGpmConfig → log lỗi/cảnh báo
        ▼
patchright.chromium.launchPersistentContext(userDataDir, options)
        ▼
core GPM đọc gpm_fg.dat → áp fingerprint ở mức C++
```

Các file sinh trong thư mục profile: `Default/GPMSoft/gpm_fg.dat` và (khi có proxy)
`Default/GPMSoft/proxy_geo.json`.

---

## 5. Phát hiện khi đo đạc

### 5.1 Core GPM chạy độc lập, điều khiển được bằng `gpm_fg.dat`
Đã kiểm chứng thay đổi theo file: timezone; hash canvas/audio (khi dùng `noise`);
`hardwareConcurrency`/`deviceMemory`; renderer WebGL (mode `fake`/`noise`); `screen`
(mode `fake`); `clientRect` (mode `noise`); adapter WebGPU (mode `fake`).

### 5.2 Lỗi rò IP WebRTC ở mode `real` (đã sửa)
Khi chạy qua proxy:

| WebRTC mode | Candidate `srflx` |
|---|---|
| `real` | **IP thật của máy** (rò) |
| `noise` | **IP thật của máy** (rò) |
| `fake` | IP thoát của proxy |

→ `applyProxyGeo` luôn đặt `webRTC.mode = "fake"` khi có proxy.

### 5.3 Core không chạy khi copy sang chỗ khác
Copy thư mục core sang `D:\`, đổi tên thư mục, hay copy dưới `%LOCALAPPDATA%`: `chrome.exe`
thoát ngay (exit code 1). Core chỉ chạy trong cây thư mục GPM đã cài. Trong `chrome.dll`
có tham chiếu `GPMLogin.exe`. **Không** xác định thêm cơ chế và **không** tìm cách vượt qua
(xem mục 8).

---

## 6. Kết quả kiểm thử

### 6.1 Test tự động
- `gpm-config.test.js` + `proxy-geo.test.js` + `browser-launch.test.js` +
  `fingerprint.test.js`: **42/42 đạt**.
- Chạy toàn bộ `tests/*.test.js`: 69/75 đạt. 6 test lỗi đều là `createProfileRecord` trong
  `profile-store.test.js`. **Lỗi có từ trước**: đã stash thay đổi của mình và chạy lại
  thì vẫn lỗi y hệt (6 fail).

Bao phủ chính: sinh/ghi/đọc/ghi lại cấu hình; giữ danh tính; nâng version kernel;
validate; nhận diện core GPM; `prepareGpmKernelProfile` không ném lỗi; căn theo proxy +
cache + tra lại khi đổi proxy + chịu lỗi khi tra thất bại; cờ GPM + viewport; liệt kê
core GPM; đọc version từ thư mục con.

### 6.2 So sánh với profile GPM đang mở thật
Cách đo: mở một trang đo vào cửa sổ GPM đang chạy, rồi chạy lại đúng trang đó bằng
`launchProfileBrowser` trên bản sao profile.

- Lần đầu: 12 chỉ số lệch → sau khi sửa (cờ `--lang`, `viewport: null`): **78 khớp / 3 lệch**.
- Khớp: UA, `sec-ch-ua*`, `Accept-Language`, `webdriver`, timezone, CPU, RAM,
  `jsHeapSizeLimit`, hash canvas, hash audio, WebGL (renderer và tham số), WebGPU, font,
  `clientRect`, plugin, `userAgentData`…
- Lệch còn lại: cổng UDP trong ICE và `rtt` (ngẫu nhiên/mạng), `innerHeight` 917 so với
  865 (chiều cao cửa sổ).

### 6.3 Thử với proxy thật và profile `test1`
- Tra vị trí qua proxy VN → `Asia/Bangkok`, Hà Nội; proxy US → `America/Los_Angeles`,
  San Jose; IP thoát thực tế khớp IP trong cache.
- Chạy upload thật trên `test1` với proxy US: 2 video đăng thành công, không có dấu hiệu
  captcha/xác minh/chặn.

---

## 7. Điểm còn mở và lưu ý

**Chưa đồng bộ hoàn toàn**
- Mọi profile **hiện có** vẫn chạy engine cũ; chỉ profile được chọn kernel core GPM mới áp dụng.
- **Profile tạo từ 16/11/2026** (`buildGpmConfig`): mỗi profile có riêng nhiễu audio, nhiễu
  canvas (`canvas.mode = noise`), nhiễu WebGL (`webgl.mode = noise` + các `uniform*Noise`,
  `readPixels*`), nhiễu `clientRect`, số nhân CPU (4–16), `deviceMemory` (4/8) và
  `jsHeapSizeLimit` tương ứng. Đã đo trên core 142: khác nhau giữa các profile, ổn định qua
  các lần mở. Các trường nhiễu để `-1` thì core bỏ qua.
- Vẫn để `real` (giống nhau giữa các profile cùng máy): tên GPU (`webglMetaMode`), `screen`,
  `font`. Lý do: tên GPU phải khớp card đang vẽ thật; screen giả mà cửa sổ thật lớn hơn là mâu
  thuẫn; `font.mode = noise` đo không thấy tác dụng.
- Profile GPM tạo **trước** ngày này giữ cấu hình cũ (chỉ nhiễu audio; canvas đang `real` nên
  `noiseToken` chưa có tác dụng). Không tự đổi để tránh fingerprint thay đổi giữa chừng.
- Extension `clipboard-ext` của GPM chưa được nạp (Playwright tắt extension).
- `--lang`: lấy từ `Preferences`, mặc định `en-US` cho profile mới; chưa có ô chọn ngôn ngữ.
- Proxy `socks` không tra được vị trí → WebRTC giữ `real` (có thể rò IP).

**WebRTC `fake` không ổn định**
Trên `test1`, danh sách ICE lúc rỗng, lúc ra `PROXY_EXIT_IP`; không lần nào thấy IP nhà.
Chưa rõ nguyên nhân; chưa so được với GPM thật dùng proxy.

**Hai bất thường phát hiện khi chạy upload thật (chưa sửa)**
1. **Giờ đặt lịch lệch theo timezone.** Tool tính giờ lịch từ đồng hồ máy (giờ Việt Nam) rồi
   nhập vào picker của TikTok Studio, nhưng picker dùng timezone của trình duyệt. Với proxy
   US, `20:20` bị hiểu là giờ Pacific → lệch khoảng 15 giờ so với dự định. Hệ quả trực tiếp
   của việc đồng bộ timezone theo proxy; sẽ lặp lại với mọi profile có proxy khác múi giờ.
2. **Link video 2 bị gán sai ID.** API `item_list` trả lại ID của video 1 và tool dùng ID đó
   thay cho ID từ `post/v1`. Lỗi có từ trước, không do GPM.

Ngoài ra `Schedule verified: date="n/a" time="n/a"` — bước kiểm tra không đọc lại được
giá trị (picker vẫn báo đúng).

**Khác**
- Viewport `null` thay đổi cách trang hiển thị với profile chạy core GPM (không còn 1280×720);
  các bước tự động dựa theo layout cần theo dõi.
- `backend/automation.log` đã lên tới ~931 MB — nên xoay vòng hoặc dọn.

---

## 8. Triển khai sang máy khác

- Copy riêng thư mục core GPM sang máy chưa cài GPM **không chạy được** (mục 5.3) và có thể
  vi phạm điều khoản của GPM. Không khuyến nghị và không tìm cách vượt qua.
- Cách hợp lệ: **cài GPM Login trên máy đó**. Tool tự nhận core tại
  `%LOCALAPPDATA%\Programs\GPMLogin\gpm_browser\...`; nếu cài chỗ khác thì đặt biến
  `GPM_BROWSER_DIR`.
- **Chưa kiểm chứng:** cài nhưng không đăng nhập GPM có chạy được không; core có sẵn hay phải
  tải sau khi đăng nhập; app GPM có cần đang mở không. Cần thử trên máy thật.
- Máy không cài GPM vẫn dùng tool như cũ với Chromium Playwright hoặc kernel trong `kernels/`
  (fingerprint lớp JS, không giống GPM hoàn toàn).

---

## 9. Cách dùng

1. Restart backend (code mới chỉ có hiệu lực sau khi restart).
2. Tạo profile mới, điền proxy.
3. **Chỉnh sửa profile → "Kernel Chromium riêng" → chọn `gpm_browser_chromium_core_142`.**
4. Mở trình duyệt. Log backend phải có `GPM core 142.0.7444.163: created gpm_fg.dat` và
   (nếu có proxy) `GPM config aligned to proxy: <timezone> (<quốc gia>) <ip>`.
5. Nhập cookie đăng nhập như profile thường.

**Không nên đổi kernel cho profile/tài khoản đang chạy** (profile Chromium 147 mở bằng core
142 có thể lỗi; đổi fingerprint giữa chừng có thể làm tài khoản bị đánh dấu). Dùng profile mới.

Đặt lại danh tính của một profile: xoá `profiles/<tên>/Default/GPMSoft/gpm_fg.dat`
(sẽ sinh lại seed mới ở lần mở sau — chỉ làm khi chủ động muốn đổi danh tính).

---

## 10. Việc đề xuất làm tiếp
1. Sửa tính giờ đặt lịch theo timezone của trình duyệt/`gpm_fg.dat` thay vì đồng hồ máy.
2. Sửa việc chọn ID video (bỏ qua kết quả `item_list` khi đã có ID từ `post/v1`).
3. Sinh fingerprint riêng cho từng profile (mode `fake`: GPU, screen, số nhân…).
4. Tìm hiểu vì sao WebRTC `fake` lúc rỗng lúc có; so với GPM thật dùng proxy.
5. Thử cài GPM không đăng nhập trên máy thứ hai.
6. Xuất/nhập `gpm_fg.dat` khi chuyển profile giữa các máy.
