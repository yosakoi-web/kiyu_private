const VIEW_PASSWORD = "2525";
const ADMIN_PASSWORD = "7290";
const STORAGE_KEY = "tsubuyaki-demo-posts-v1";
const PROFILE_KEY = "tsubuyaki-demo-profile-v1";
const ROLE_KEY = "tsubuyaki-demo-role";
const MAX_TEXT_LENGTH = 1000;
const MAX_IMAGES = 10;
const MAX_VIDEO_SIZE = 4 * 1024 * 1024 * 1024;

const $ = (selector) => document.querySelector(selector);

const elements = {
  loginScreen: $("#loginScreen"),
  appShell: $("#appShell"),
  loginForm: $("#loginForm"),
  password: $("#password"),
  loginError: $("#loginError"),
  logoutButton: $("#logoutButton"),
  homeButton: $("#homeButton"),
  profileEditButton: $("#profileEditButton"),
  profileCover: $("#profileCover"),
  profileAvatar: $("#profileAvatar"),
  profileName: $("#profileName"),
  profileHandle: $("#profileHandle"),
  profileBio: $("#profileBio"),
  mobileProfileCover: $("#mobileProfileCover"),
  mobileProfileAvatar: $("#mobileProfileAvatar"),
  mobileProfileName: $("#mobileProfileName"),
  mobileProfileHandle: $("#mobileProfileHandle"),
  mobileProfileBio: $("#mobileProfileBio"),
  composerAvatar: $("#composerAvatar"),
  roleBadge: $("#roleBadge"),
  viewerNotice: $("#viewerNotice"),
  composer: $("#composer"),
  postForm: $("#postForm"),
  postText: $("#postText"),
  youtubeInput: $("#youtubeInput"),
  photoInput: $("#photoInput"),
  imagePreviews: $("#imagePreviews"),
  photoSelectionCount: $("#photoSelectionCount"),
  videoInput: $("#videoInput"),
  videoPreviewWrap: $("#videoPreviewWrap"),
  videoPreview: $("#videoPreview"),
  videoMeta: $("#videoMeta"),
  removeVideo: $("#removeVideo"),
  charCount: $("#charCount"),
  timelineFeed: $("#timelineFeed"),
  emptyState: $("#emptyState"),
  postCount: $("#postCount"),
  photoCount: $("#photoCount"),
  editModal: $("#editModal"),
  editText: $("#editText"),
  cancelEdit: $("#cancelEdit"),
  saveEdit: $("#saveEdit"),
  deleteModal: $("#deleteModal"),
  cancelDelete: $("#cancelDelete"),
  confirmDelete: $("#confirmDelete"),
  profileModal: $("#profileModal"),
  profileNameInput: $("#profileNameInput"),
  profileHandleInput: $("#profileHandleInput"),
  profileBioInput: $("#profileBioInput"),
  profileAvatarInput: $("#profileAvatarInput"),
  profileBannerInput: $("#profileBannerInput"),
  profilePreviewCover: $("#profilePreviewCover"),
  profilePreviewAvatar: $("#profilePreviewAvatar"),
  removeProfileAvatar: $("#removeProfileAvatar"),
  removeProfileBanner: $("#removeProfileBanner"),
  cancelProfileEdit: $("#cancelProfileEdit"),
  saveProfile: $("#saveProfile"),
  imageLightbox: $("#imageLightbox"),
  lightboxImage: $("#lightboxImage"),
  closeLightbox: $("#closeLightbox"),
  toast: $("#toast")
};

const initialPosts = [
  {
    id: crypto.randomUUID(),
    text: "新舞子マリンパークフェスの写真を整理中。スマホから短い記録と一緒に残せるようにしてみた。",
    images: ["./sample-event.svg"],
    video: null,
    youtubeId: null,
    createdAt: "2026-07-17T11:30:00+09:00"
  },
  {
    id: crypto.randomUUID(),
    text: "閲覧用では見るだけ。管理者用で入った場合だけ、投稿、編集、削除ができる。",
    images: [],
    video: null,
    youtubeId: null,
    createdAt: "2026-07-17T09:10:00+09:00"
  }
];

const defaultProfile = {
  name: "Ericの記録",
  handle: "private_note",
  bio: "写真と短い記録を残す、身内向けの非公開ページ。",
  avatar: null,
  banner: null
};

let posts = loadPosts();
let profile = loadProfile();
let pendingImages = [];
let pendingVideo = null;
let pendingProfileAvatar = profile.avatar;
let pendingProfileBanner = profile.banner;
let editingId = null;
let deletingId = null;
let toastTimer = null;
let currentRole = null;

function loadPosts() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialPosts;
  } catch {
    return initialPosts;
  }
}

function loadProfile() {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    return saved ? { ...defaultProfile, ...JSON.parse(saved) } : { ...defaultProfile };
  } catch {
    return { ...defaultProfile };
  }
}

function saveProfileData() {
  try {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    return true;
  } catch {
    showToast("プロフィール画像の保存容量が足りません");
    return false;
  }
}

function savePosts() {
  try {
    const serializable = posts.map((post) => ({
      ...post,
      video: post.video ? { ...post.video, previewUrl: null } : null
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
  } catch {
    showToast("端末内の保存容量が足りません");
  }
}

function showApp(role) {
  currentRole = role;
  const isAdmin = role === "admin";
  elements.loginScreen.classList.add("is-hidden");
  elements.appShell.classList.remove("is-hidden");
  elements.composer.classList.toggle("is-hidden", !isAdmin);
  elements.viewerNotice.classList.toggle("is-hidden", isAdmin);
  elements.profileEditButton.classList.toggle("is-hidden", !isAdmin);
  elements.roleBadge.textContent = isAdmin ? "管理者" : "閲覧専用";
  elements.roleBadge.classList.toggle("admin", isAdmin);
  renderProfile();
  renderPosts();
}

function showLogin() {
  elements.appShell.classList.add("is-hidden");
  elements.loginScreen.classList.remove("is-hidden");
  elements.password.value = "";
  setTimeout(() => elements.password.focus(), 50);
}

elements.loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const role = elements.password.value === ADMIN_PASSWORD
    ? "admin"
    : elements.password.value === VIEW_PASSWORD
      ? "viewer"
      : null;

  if (!role) {
    elements.loginError.textContent = "パスワードが違います";
    elements.password.select();
    return;
  }

  sessionStorage.setItem(ROLE_KEY, role);
  elements.loginError.textContent = "";
  showApp(role);
});

elements.logoutButton.addEventListener("click", () => {
  sessionStorage.removeItem(ROLE_KEY);
  currentRole = null;
  showLogin();
});

elements.homeButton.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
elements.profileEditButton.addEventListener("click", openProfileEditor);

elements.postText.addEventListener("input", () => {
  elements.charCount.textContent = String(MAX_TEXT_LENGTH - elements.postText.value.length);
});

elements.photoInput.addEventListener("change", async () => {
  const selected = Array.from(elements.photoInput.files ?? []);
  const remaining = MAX_IMAGES - pendingImages.length;
  const accepted = selected.filter((file) => file.type.startsWith("image/")).slice(0, remaining);

  if (selected.length > remaining) showToast(`写真は最大${MAX_IMAGES}枚です`);
  if (!accepted.length) {
    elements.photoInput.value = "";
    return;
  }

  for (const file of accepted) {
    try {
      const data = await compressImage(file);
      pendingImages.push({ id: crypto.randomUUID(), data, name: file.name });
      renderPendingImages();
    } catch {
      showToast(`${file.name}を読み込めませんでした`);
    }
  }

  elements.photoInput.value = "";
});

elements.imagePreviews.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-image-id]");
  if (!button) return;
  pendingImages = pendingImages.filter((image) => image.id !== button.dataset.imageId);
  renderPendingImages();
});

elements.videoInput.addEventListener("change", () => {
  const file = elements.videoInput.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("video/")) {
    showToast("動画ファイルを選んでください");
    elements.videoInput.value = "";
    return;
  }
  if (file.size > MAX_VIDEO_SIZE) {
    showToast("動画は4GBまでです");
    elements.videoInput.value = "";
    return;
  }

  clearPendingVideo();
  const previewUrl = URL.createObjectURL(file);
  pendingVideo = { file, previewUrl };
  elements.videoPreview.src = previewUrl;
  elements.videoMeta.textContent = `${file.name}　${formatBytes(file.size)}`;
  elements.videoPreviewWrap.classList.remove("is-hidden");
});

elements.removeVideo.addEventListener("click", () => clearPendingVideo());

elements.postForm.addEventListener("submit", (event) => {
  event.preventDefault();
  if (currentRole !== "admin") return;

  const text = elements.postText.value.trim();
  const youtubeValue = elements.youtubeInput.value.trim();
  const youtubeId = youtubeValue ? getYouTubeId(youtubeValue) : null;

  if (youtubeValue && !youtubeId) {
    showToast("YouTubeリンクを確認してください");
    return;
  }
  if (!text && !pendingImages.length && !pendingVideo && !youtubeId) {
    showToast("文章またはメディアを追加してください");
    return;
  }

  const video = pendingVideo
    ? {
        name: pendingVideo.file.name,
        size: pendingVideo.file.size,
        type: pendingVideo.file.type,
        previewUrl: pendingVideo.previewUrl
      }
    : null;

  posts.unshift({
    id: crypto.randomUUID(),
    text,
    images: pendingImages.map((image) => image.data),
    video,
    youtubeId,
    createdAt: new Date().toISOString()
  });

  savePosts();
  resetComposerAfterPost();
  renderPosts();
  showToast(video ? "動画を投稿しました。再生は現在の画面内で有効です" : "投稿しました");
});

elements.timelineFeed.addEventListener("click", (event) => {
  if (currentRole !== "admin") return;
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const { action, id } = button.dataset;
  const post = posts.find((item) => item.id === id);
  if (!post) return;

  if (action === "edit") {
    editingId = id;
    elements.editText.value = post.text ?? "";
    elements.editModal.classList.remove("is-hidden");
    setTimeout(() => elements.editText.focus(), 30);
  }

  if (action === "delete") {
    deletingId = id;
    elements.deleteModal.classList.remove("is-hidden");
  }
});

elements.cancelEdit.addEventListener("click", closeEditModal);
elements.editModal.addEventListener("click", (event) => {
  if (event.target === elements.editModal) closeEditModal();
});

elements.saveEdit.addEventListener("click", () => {
  if (!editingId) return;
  const text = elements.editText.value.trim();
  const target = posts.find((post) => post.id === editingId);
  const hasMedia = getPostImages(target).length || target?.video || target?.youtubeId;
  if (!text && !hasMedia) {
    showToast("文章を入力してください");
    return;
  }

  posts = posts.map((post) => post.id === editingId ? { ...post, text } : post);
  savePosts();
  renderPosts();
  closeEditModal();
  showToast("変更を保存しました");
});

elements.cancelDelete.addEventListener("click", closeDeleteModal);
elements.deleteModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteModal) closeDeleteModal();
});

elements.confirmDelete.addEventListener("click", () => {
  if (!deletingId || currentRole !== "admin") return;
  const target = posts.find((post) => post.id === deletingId);
  if (target?.video?.previewUrl) URL.revokeObjectURL(target.video.previewUrl);
  posts = posts.filter((post) => post.id !== deletingId);
  savePosts();
  renderPosts();
  closeDeleteModal();
  showToast("削除しました");
});

elements.profileAvatarInput.addEventListener("change", async () => {
  const file = elements.profileAvatarInput.files?.[0];
  if (!file) return;
  try {
    pendingProfileAvatar = await compressImage(file, { max: 512, quality: .84 });
    renderProfilePreview();
  } catch {
    showToast("アイコン画像を読み込めませんでした");
  }
  elements.profileAvatarInput.value = "";
});

elements.profileBannerInput.addEventListener("change", async () => {
  const file = elements.profileBannerInput.files?.[0];
  if (!file) return;
  try {
    pendingProfileBanner = await compressImage(file, { max: 1600, quality: .8 });
    renderProfilePreview();
  } catch {
    showToast("バナー画像を読み込めませんでした");
  }
  elements.profileBannerInput.value = "";
});

elements.removeProfileAvatar.addEventListener("click", () => {
  pendingProfileAvatar = null;
  renderProfilePreview();
});

elements.removeProfileBanner.addEventListener("click", () => {
  pendingProfileBanner = null;
  renderProfilePreview();
});

elements.profileNameInput.addEventListener("input", renderProfilePreview);
elements.cancelProfileEdit.addEventListener("click", closeProfileEditor);
elements.profileModal.addEventListener("click", (event) => {
  if (event.target === elements.profileModal) closeProfileEditor();
});

elements.saveProfile.addEventListener("click", () => {
  if (currentRole !== "admin") return;
  const name = elements.profileNameInput.value.trim();
  const handle = elements.profileHandleInput.value
    .trim()
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_\-぀-ヿ㐀-鿿]/g, "")
    .slice(0, 20);

  if (!name) {
    showToast("表示名を入力してください");
    elements.profileNameInput.focus();
    return;
  }
  if (!handle) {
    showToast("ユーザー名を入力してください");
    elements.profileHandleInput.focus();
    return;
  }

  profile = {
    name,
    handle,
    bio: elements.profileBioInput.value.trim(),
    avatar: pendingProfileAvatar,
    banner: pendingProfileBanner
  };

  if (!saveProfileData()) return;
  renderProfile();
  renderPosts();
  closeProfileEditor();
  showToast("プロフィールを保存しました");
});

elements.closeLightbox.addEventListener("click", closeLightbox);
elements.imageLightbox.addEventListener("click", (event) => {
  if (event.target === elements.imageLightbox) closeLightbox();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeEditModal();
  closeDeleteModal();
  closeProfileEditor();
  closeLightbox();
});

function closeEditModal() {
  editingId = null;
  elements.editModal.classList.add("is-hidden");
}

function closeDeleteModal() {
  deletingId = null;
  elements.deleteModal.classList.add("is-hidden");
}

function openProfileEditor() {
  if (currentRole !== "admin") return;
  pendingProfileAvatar = profile.avatar;
  pendingProfileBanner = profile.banner;
  elements.profileNameInput.value = profile.name;
  elements.profileHandleInput.value = profile.handle;
  elements.profileBioInput.value = profile.bio;
  renderProfilePreview();
  elements.profileModal.classList.remove("is-hidden");
}

function closeProfileEditor() {
  elements.profileModal.classList.add("is-hidden");
}

function renderProfilePreview() {
  applyCover(elements.profilePreviewCover, pendingProfileBanner);
  setAvatar(elements.profilePreviewAvatar, pendingProfileAvatar, elements.profileNameInput.value || profile.name);
}

function openLightbox(source) {
  elements.lightboxImage.src = source;
  elements.imageLightbox.classList.remove("is-hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  if (elements.imageLightbox.classList.contains("is-hidden")) return;
  elements.imageLightbox.classList.add("is-hidden");
  elements.lightboxImage.removeAttribute("src");
  document.body.style.overflow = "";
}

function renderPendingImages() {
  elements.imagePreviews.replaceChildren();

  pendingImages.forEach((image, index) => {
    const item = document.createElement("div");
    item.className = "image-preview-item";

    const preview = document.createElement("img");
    preview.src = image.data;
    preview.alt = `選択した写真 ${index + 1}`;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.dataset.imageId = image.id;
    remove.setAttribute("aria-label", `写真${index + 1}を外す`);
    remove.textContent = "×";

    item.append(preview, remove);
    elements.imagePreviews.append(item);
  });

  elements.imagePreviews.classList.toggle("is-hidden", pendingImages.length === 0);
  elements.photoSelectionCount.textContent = `${pendingImages.length}/${MAX_IMAGES}`;
}

function clearPendingVideo({ revoke = true } = {}) {
  if (pendingVideo?.previewUrl && revoke) URL.revokeObjectURL(pendingVideo.previewUrl);
  pendingVideo = null;
  elements.videoInput.value = "";
  elements.videoPreview.pause();
  elements.videoPreview.removeAttribute("src");
  elements.videoPreview.load();
  elements.videoMeta.textContent = "";
  elements.videoPreviewWrap.classList.add("is-hidden");
}

function resetComposerAfterPost() {
  elements.postText.value = "";
  elements.youtubeInput.value = "";
  elements.charCount.textContent = String(MAX_TEXT_LENGTH);
  pendingImages = [];
  renderPendingImages();
  clearPendingVideo({ revoke: false });
}

function renderProfile() {
  elements.profileName.textContent = profile.name;
  elements.profileHandle.textContent = `@${profile.handle}`;
  elements.profileBio.textContent = profile.bio;
  elements.mobileProfileName.textContent = profile.name;
  elements.mobileProfileHandle.textContent = `@${profile.handle}`;
  elements.mobileProfileBio.textContent = profile.bio;

  applyCover(elements.profileCover, profile.banner);
  applyCover(elements.mobileProfileCover, profile.banner);
  setAvatar(elements.profileAvatar, profile.avatar, profile.name);
  setAvatar(elements.mobileProfileAvatar, profile.avatar, profile.name);
  setAvatar(elements.composerAvatar, profile.avatar, profile.name);
}

function applyCover(element, source) {
  element.style.backgroundImage = source ? `url("${source}")` : "";
}

function setAvatar(element, source, name) {
  element.replaceChildren();
  if (source) {
    const image = document.createElement("img");
    image.src = source;
    image.alt = "";
    element.append(image);
    return;
  }
  element.textContent = Array.from(name || "E")[0]?.toUpperCase() || "E";
}

function renderPosts() {
  elements.timelineFeed.replaceChildren();
  posts.forEach((post) => elements.timelineFeed.append(createPostElement(post)));
  elements.emptyState.classList.toggle("is-hidden", posts.length > 0);
  elements.postCount.textContent = String(posts.length);
  elements.photoCount.textContent = String(posts.reduce((total, post) => total + getPostImages(post).length, 0));
}

function createPostElement(post) {
  const article = document.createElement("article");
  article.className = "post";

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  setAvatar(avatar, profile.avatar, profile.name);

  const body = document.createElement("div");
  body.className = "post-body";

  const meta = document.createElement("div");
  meta.className = "post-meta";
  const name = document.createElement("span");
  name.className = "post-name";
  name.textContent = profile.name;
  const handle = document.createElement("span");
  handle.className = "post-handle";
  handle.textContent = `@${profile.handle}`;
  const time = document.createElement("time");
  time.className = "post-time";
  time.textContent = formatDate(post.createdAt);
  meta.append(name, handle, time);
  body.append(meta);

  if (post.text) {
    const text = document.createElement("p");
    text.className = "post-text";
    text.textContent = post.text;
    body.append(text);
  }

  const images = getPostImages(post);
  if (images.length) {
    const grid = document.createElement("div");
    grid.className = `post-media-grid${images.length === 1 ? " one" : ""}`;
    images.forEach((source, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "post-image-button";
      button.setAttribute("aria-label", `写真${index + 1}を拡大する`);
      button.addEventListener("click", () => openLightbox(source));

      const image = document.createElement("img");
      image.className = "post-image";
      image.src = source;
      image.alt = `投稿された写真 ${index + 1}`;
      image.loading = "lazy";
      button.append(image);
      grid.append(button);
    });
    body.append(grid);
  }

  if (post.video) {
    if (post.video.previewUrl) {
      const video = document.createElement("video");
      video.className = "post-video";
      video.src = post.video.previewUrl;
      video.controls = true;
      video.playsInline = true;
      video.preload = "metadata";
      body.append(video);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "video-placeholder";
      placeholder.textContent = `${post.video.name}（${formatBytes(post.video.size)}）は本番ストレージ接続後に再生できます`;
      body.append(placeholder);
    }
  }

  if (post.youtubeId) {
    const frame = document.createElement("div");
    frame.className = "youtube-embed";
    const iframe = document.createElement("iframe");
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(post.youtubeId)}`;
    iframe.title = "YouTube動画";
    iframe.loading = "lazy";
    iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
    iframe.allowFullscreen = true;
    frame.append(iframe);
    body.append(frame);
  }

  if (currentRole === "admin") {
    const actions = document.createElement("div");
    actions.className = "post-actions";
    actions.innerHTML = `
      <button class="post-action" type="button" data-action="edit" data-id="${post.id}">編集</button>
      <button class="post-action danger" type="button" data-action="delete" data-id="${post.id}">削除</button>
    `;
    body.append(actions);
  }

  article.append(avatar, body);
  return article;
}

function getPostImages(post) {
  if (Array.isArray(post?.images)) return post.images;
  return post?.image ? [post.image] : [];
}

function getYouTubeId(value) {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/^www\./, "");

    if (host === "youtu.be") return cleanYouTubeId(url.pathname.split("/").filter(Boolean)[0]);

    if (["youtube.com", "m.youtube.com", "music.youtube.com"].includes(host)) {
      if (url.pathname === "/watch") return cleanYouTubeId(url.searchParams.get("v"));
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live"].includes(parts[0])) return cleanYouTubeId(parts[1]);
    }
  } catch {
    return null;
  }
  return null;
}

function cleanYouTubeId(value) {
  return value && /^[A-Za-z0-9_-]{6,20}$/.test(value) ? value : null;
}

function formatDate(value) {
  const date = new Date(value);
  const now = new Date();
  const sameYear = date.getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat("ja-JP", sameYear
    ? { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }
    : { year: "numeric", month: "numeric", day: "numeric" }
  ).format(date);
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / (1024 ** index);
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)}${units[index]}`;
}

async function compressImage(file, { max = 960, quality = .76 } = {}) {
  const source = await loadImage(file);
  const widthSource = source.naturalWidth || source.width;
  const heightSource = source.naturalHeight || source.height;
  const scale = Math.min(1, max / Math.max(widthSource, heightSource));
  const width = Math.max(1, Math.round(widthSource * scale));
  const height = Math.max(1, Math.round(heightSource * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  context.fillStyle = "#fff";
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  if (typeof source.close === "function") source.close();
  return canvas.toDataURL("image/jpeg", quality);
}

async function loadImage(file) {
  if ("createImageBitmap" in window) return createImageBitmap(file);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => resolve(image);
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2400);
}

const savedRole = sessionStorage.getItem(ROLE_KEY);
if (savedRole === "admin" || savedRole === "viewer") showApp(savedRole);
else showLogin();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
