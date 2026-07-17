const VIEW_PASSWORD = "2525";
const ADMIN_PASSWORD = "7290";
const ROLE_KEY = "kiyu-role";
const TOKEN_LOCAL_KEY = "kiyu-github-token";
const TOKEN_SESSION_KEY = "kiyu-github-token-session";
const GITHUB_OWNER = "yosakoi-web";
const GITHUB_REPO = "kiyu_private";
const GITHUB_BRANCH = "main";
const STATE_PATH = "data/state.json";
const MAX_TEXT_LENGTH = 1000;
const MAX_IMAGES = 10;

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
  syncSettingsButton: $("#syncSettingsButton"),
  mobileProfileCover: $("#mobileProfileCover"),
  mobileProfileAvatar: $("#mobileProfileAvatar"),
  mobileProfileName: $("#mobileProfileName"),
  mobileProfileHandle: $("#mobileProfileHandle"),
  mobileProfileBio: $("#mobileProfileBio"),
  composerAvatar: $("#composerAvatar"),
  roleBadge: $("#roleBadge"),
  viewerNotice: $("#viewerNotice"),
  syncStatus: $("#syncStatus"),
  syncStatusText: $("#syncStatusText"),
  refreshDataButton: $("#refreshDataButton"),
  composer: $("#composer"),
  postForm: $("#postForm"),
  postText: $("#postText"),
  youtubeInput: $("#youtubeInput"),
  photoInput: $("#photoInput"),
  imagePreviews: $("#imagePreviews"),
  photoSelectionCount: $("#photoSelectionCount"),
  charCount: $("#charCount"),
  timelineFeed: $("#timelineFeed"),
  emptyState: $("#emptyState"),
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
  githubModal: $("#githubModal"),
  githubTokenInput: $("#githubTokenInput"),
  rememberTokenInput: $("#rememberTokenInput"),
  connectionMessage: $("#connectionMessage"),
  clearTokenButton: $("#clearTokenButton"),
  cancelGithubButton: $("#cancelGithubButton"),
  connectGithubButton: $("#connectGithubButton"),
  imageLightbox: $("#imageLightbox"),
  lightboxImage: $("#lightboxImage"),
  closeLightbox: $("#closeLightbox"),
  toast: $("#toast"),
  busyOverlay: $("#busyOverlay"),
  busyMessage: $("#busyMessage")
};

const fallbackState = {
  version: 1,
  updatedAt: "2026-07-18T00:00:00+09:00",
  profile: {
    name: "Ericの記録",
    handle: "private_note",
    bio: "写真と短い記録を残す、身内向けの非公開ページ。",
    avatar: null,
    banner: null
  },
  posts: [
    {
      id: "welcome-photo",
      text: "スマホから投稿した内容は、見る人のスマホにも同じように表示されます。",
      images: ["sample-event.svg"],
      youtubeId: null,
      createdAt: "2026-07-18T00:00:00+09:00"
    },
    {
      id: "welcome-role",
      text: "閲覧用では見るだけ。管理者用で入った場合だけ、投稿、編集、削除ができます。",
      images: [],
      youtubeId: null,
      createdAt: "2026-07-17T23:50:00+09:00"
    }
  ]
};

let state = normalizeState(fallbackState);
let posts = state.posts;
let profile = state.profile;
let pendingImages = [];
let pendingProfileAvatar = profile.avatar;
let pendingProfileBanner = profile.banner;
let editingId = null;
let deletingId = null;
let toastTimer = null;
let currentRole = null;
let loadSequence = 0;

function showApp(role) {
  currentRole = role;
  const isAdmin = role === "admin";
  elements.loginScreen.classList.add("is-hidden");
  elements.appShell.classList.remove("is-hidden");
  elements.composer.classList.toggle("is-hidden", !isAdmin);
  elements.viewerNotice.classList.toggle("is-hidden", isAdmin);
  elements.profileEditButton.classList.toggle("is-hidden", !isAdmin);
  elements.syncSettingsButton.classList.toggle("is-hidden", !isAdmin);
  elements.roleBadge.textContent = isAdmin ? "管理者" : "閲覧専用";
  elements.roleBadge.classList.toggle("admin", isAdmin);
  renderProfile();
  renderPosts();
  loadSharedState().finally(() => {
    if (isAdmin && !getStoredToken()) window.setTimeout(openGithubModal, 250);
  });
}

function showLogin() {
  elements.appShell.classList.add("is-hidden");
  elements.loginScreen.classList.remove("is-hidden");
  elements.password.value = "";
  window.setTimeout(() => elements.password.focus(), 50);
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
elements.syncSettingsButton.addEventListener("click", openGithubModal);
elements.refreshDataButton.addEventListener("click", () => loadSharedState());

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
      pendingImages.push({ id: createId(), data, name: file.name });
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

elements.postForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (currentRole !== "admin") return;

  const text = elements.postText.value.trim();
  const youtubeValue = elements.youtubeInput.value.trim();
  const youtubeId = youtubeValue ? getYouTubeId(youtubeValue) : null;

  if (youtubeValue && !youtubeId) {
    showToast("YouTubeリンクを確認してください");
    return;
  }
  if (!text && !pendingImages.length && !youtubeId) {
    showToast("文章、写真、YouTubeリンクのどれかを追加してください");
    return;
  }

  const token = requireGithubToken();
  if (!token) return;

  showBusy(pendingImages.length ? "写真をアップロード中" : "投稿を保存中");
  setSyncStatus("saving", "GitHubへ保存中");

  try {
    const uploadedImages = [];
    for (let index = 0; index < pendingImages.length; index += 1) {
      elements.busyMessage.textContent = `写真をアップロード中 ${index + 1}/${pendingImages.length}`;
      uploadedImages.push(await uploadImageData(pendingImages[index].data, `post-${Date.now()}-${index + 1}-${createId()}.jpg`, token));
    }

    const nextPosts = [{
      id: createId(),
      text,
      images: uploadedImages,
      youtubeId,
      createdAt: new Date().toISOString()
    }, ...posts];

    elements.busyMessage.textContent = "投稿を保存中";
    await commitState(nextPosts, profile, "Add timeline post", token);
    resetComposerAfterPost();
    renderPosts();
    showToast("投稿しました");
  } catch (error) {
    handleSaveError(error);
  } finally {
    hideBusy();
  }
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
    window.setTimeout(() => elements.editText.focus(), 30);
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

elements.saveEdit.addEventListener("click", async () => {
  if (!editingId || currentRole !== "admin") return;
  const text = elements.editText.value.trim();
  const target = posts.find((post) => post.id === editingId);
  const hasMedia = getPostImages(target).length || target?.youtubeId;
  if (!text && !hasMedia) {
    showToast("文章を入力してください");
    return;
  }

  const token = requireGithubToken();
  if (!token) return;
  const nextPosts = posts.map((post) => post.id === editingId ? { ...post, text } : post);
  showBusy("変更を保存中");
  setSyncStatus("saving", "GitHubへ保存中");

  try {
    await commitState(nextPosts, profile, "Edit timeline post", token);
    renderPosts();
    closeEditModal();
    showToast("変更を保存しました");
  } catch (error) {
    handleSaveError(error);
  } finally {
    hideBusy();
  }
});

elements.cancelDelete.addEventListener("click", closeDeleteModal);
elements.deleteModal.addEventListener("click", (event) => {
  if (event.target === elements.deleteModal) closeDeleteModal();
});

elements.confirmDelete.addEventListener("click", async () => {
  if (!deletingId || currentRole !== "admin") return;
  const token = requireGithubToken();
  if (!token) return;
  const nextPosts = posts.filter((post) => post.id !== deletingId);
  showBusy("投稿を削除中");
  setSyncStatus("saving", "GitHubへ保存中");

  try {
    await commitState(nextPosts, profile, "Delete timeline post", token);
    renderPosts();
    closeDeleteModal();
    showToast("削除しました");
  } catch (error) {
    handleSaveError(error);
  } finally {
    hideBusy();
  }
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

elements.saveProfile.addEventListener("click", async () => {
  if (currentRole !== "admin") return;
  const name = elements.profileNameInput.value.trim();
  const handle = elements.profileHandleInput.value
    .trim()
    .replace(/^@/, "")
    .replace(/[^A-Za-z0-9_\-\u3040-\u30ff\u3400-\u9fff]/g, "")
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

  const token = requireGithubToken();
  if (!token) return;
  showBusy("プロフィールを保存中");
  setSyncStatus("saving", "GitHubへ保存中");

  try {
    let avatar = pendingProfileAvatar;
    let banner = pendingProfileBanner;
    if (isDataImage(avatar)) {
      elements.busyMessage.textContent = "アイコンをアップロード中";
      avatar = await uploadImageData(avatar, `profile-avatar-${Date.now()}-${createId()}.jpg`, token);
    }
    if (isDataImage(banner)) {
      elements.busyMessage.textContent = "バナーをアップロード中";
      banner = await uploadImageData(banner, `profile-banner-${Date.now()}-${createId()}.jpg`, token);
    }

    const nextProfile = {
      name,
      handle,
      bio: elements.profileBioInput.value.trim(),
      avatar,
      banner
    };

    elements.busyMessage.textContent = "プロフィールを保存中";
    await commitState(posts, nextProfile, "Update timeline profile", token);
    renderProfile();
    renderPosts();
    closeProfileEditor();
    showToast("プロフィールを保存しました");
  } catch (error) {
    handleSaveError(error);
  } finally {
    hideBusy();
  }
});

elements.cancelGithubButton.addEventListener("click", closeGithubModal);
elements.githubModal.addEventListener("click", (event) => {
  if (event.target === elements.githubModal) closeGithubModal();
});

elements.clearTokenButton.addEventListener("click", () => {
  localStorage.removeItem(TOKEN_LOCAL_KEY);
  sessionStorage.removeItem(TOKEN_SESSION_KEY);
  elements.githubTokenInput.value = "";
  setConnectionMessage("保存済みトークンを削除しました", true);
  setSyncStatus("error", "GitHub未接続");
});

elements.connectGithubButton.addEventListener("click", async () => {
  const token = elements.githubTokenInput.value.trim();
  if (!token) {
    setConnectionMessage("トークンを貼り付けてください");
    elements.githubTokenInput.focus();
    return;
  }

  elements.connectGithubButton.disabled = true;
  setConnectionMessage("接続を確認中", true);

  try {
    const response = await fetch(`https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}`, {
      headers: githubHeaders(token),
      cache: "no-store"
    });

    if (!response.ok) throw await createGithubError(response);
    const repository = await response.json();
    if (repository.full_name?.toLowerCase() !== `${GITHUB_OWNER}/${GITHUB_REPO}`.toLowerCase()) {
      throw new Error("接続先リポジトリを確認できませんでした");
    }
    if (repository.permissions?.push === false) {
      throw new Error("このトークンには書き込み権限がありません。ContentsをRead and writeにしてください");
    }

    storeToken(token, elements.rememberTokenInput.checked);
    setConnectionMessage("接続できました", true);
    await loadSharedState();
    window.setTimeout(closeGithubModal, 650);
  } catch (error) {
    setConnectionMessage(toUserError(error));
  } finally {
    elements.connectGithubButton.disabled = false;
  }
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
  closeGithubModal();
  closeLightbox();
});

async function loadSharedState() {
  const sequence = ++loadSequence;
  setSyncStatus("loading", "共通データを読み込み中");
  elements.refreshDataButton.disabled = true;
  const token = currentRole === "admin" ? getStoredToken() : "";

  try {
    let loaded;
    let source = "GitHub";
    try {
      loaded = await fetchStateFromGithub(token);
    } catch {
      loaded = await fetchStateFromPages();
      source = "公開ページ";
    }

    if (sequence !== loadSequence) return;
    state = normalizeState(loaded);
    posts = state.posts;
    profile = state.profile;
    pendingProfileAvatar = profile.avatar;
    pendingProfileBanner = profile.banner;
    renderProfile();
    renderPosts();
    setSyncStatus("ok", `${source}から同期 ${formatSyncTime(state.updatedAt)}`);
  } catch {
    if (sequence !== loadSequence) return;
    setSyncStatus("error", "共通データを取得できません。更新を押してください");
  } finally {
    if (sequence === loadSequence) elements.refreshDataButton.disabled = false;
  }
}

async function fetchStateFromGithub(token = "") {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${STATE_PATH}?ref=${encodeURIComponent(GITHUB_BRANCH)}&t=${Date.now()}`;
  const response = await fetch(url, {
    headers: githubHeaders(token, { Accept: "application/vnd.github.raw+json" }),
    cache: "no-store"
  });
  if (!response.ok) throw await createGithubError(response);
  const text = await response.text();
  const parsed = JSON.parse(text);
  if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
    return JSON.parse(base64ToUtf8(parsed.content));
  }
  return parsed;
}

async function fetchStateFromPages() {
  const response = await fetch(`./${STATE_PATH}?t=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) throw new Error("公開データを取得できませんでした");
  return response.json();
}

async function commitState(nextPosts, nextProfile, message, token) {
  const nextState = normalizeState({
    version: 1,
    updatedAt: new Date().toISOString(),
    profile: nextProfile,
    posts: nextPosts
  });

  const content = utf8ToBase64(`${JSON.stringify(nextState, null, 2)}\n`);
  await putGithubFile(STATE_PATH, content, message, token);
  state = nextState;
  posts = state.posts;
  profile = state.profile;
  pendingProfileAvatar = profile.avatar;
  pendingProfileBanner = profile.banner;
  setSyncStatus("ok", `GitHubへ保存 ${formatSyncTime(state.updatedAt)}`);
}

async function uploadImageData(dataUrl, filename, token) {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("写真データを読み込めませんでした");
  const path = `media/${filename}`;
  await putGithubFile(path, match[1], "Upload timeline image", token);
  return path;
}

async function putGithubFile(path, base64Content, message, token) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    let sha;
    const current = await fetch(`${url}?ref=${encodeURIComponent(GITHUB_BRANCH)}&t=${Date.now()}`, {
      headers: githubHeaders(token),
      cache: "no-store"
    });

    if (current.ok) {
      const metadata = await current.json();
      sha = metadata.sha;
    } else if (current.status !== 404) {
      throw await createGithubError(current);
    }

    const body = {
      message,
      content: base64Content,
      branch: GITHUB_BRANCH
    };
    if (sha) body.sha = sha;

    const response = await fetch(url, {
      method: "PUT",
      headers: githubHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify(body)
    });

    if (response.ok) return response.json();
    if (response.status !== 409 || attempt === 1) throw await createGithubError(response);
  }

  throw new Error("GitHubへの保存に失敗しました");
}

function githubHeaders(token = "", extra = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...extra
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function createGithubError(response) {
  let message = "";
  try {
    const body = await response.json();
    message = body.message ?? "";
  } catch {
    message = "";
  }
  const error = new Error(message || `GitHub error ${response.status}`);
  error.status = response.status;
  return error;
}

function toUserError(error) {
  if (error?.status === 401) return "トークンが正しくありません。作り直した場合は新しい方を貼ってください";
  if (error?.status === 403) return "トークンの権限が足りません。ContentsをRead and writeにしてください";
  if (error?.status === 404) return "kiyu_privateへ接続できません。Repository accessで選択されているか確認してください";
  if (error?.status === 409) return "同時に更新されました。更新を押してから、もう一度保存してください";
  if (error?.status === 422) return "GitHubが保存を受け付けませんでした。mainブランチと権限を確認してください";
  if (error instanceof TypeError) return "通信できませんでした。電波を確認してもう一度試してください";
  return error?.message || "保存できませんでした";
}

function handleSaveError(error) {
  setSyncStatus("error", "保存できませんでした");
  showToast(toUserError(error));
}

function getStoredToken() {
  return sessionStorage.getItem(TOKEN_SESSION_KEY) || localStorage.getItem(TOKEN_LOCAL_KEY) || "";
}

function storeToken(token, remember) {
  if (remember) {
    localStorage.setItem(TOKEN_LOCAL_KEY, token);
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
  } else {
    sessionStorage.setItem(TOKEN_SESSION_KEY, token);
    localStorage.removeItem(TOKEN_LOCAL_KEY);
  }
}

function requireGithubToken() {
  const token = getStoredToken();
  if (token) return token;
  openGithubModal();
  showToast("先にGitHubへ接続してください");
  return "";
}

function openGithubModal() {
  if (currentRole !== "admin") return;
  elements.githubTokenInput.value = getStoredToken();
  elements.connectionMessage.textContent = "";
  elements.connectionMessage.classList.remove("success");
  elements.githubModal.classList.remove("is-hidden");
  window.setTimeout(() => elements.githubTokenInput.focus(), 30);
}

function closeGithubModal() {
  elements.githubModal.classList.add("is-hidden");
}

function setConnectionMessage(message, success = false) {
  elements.connectionMessage.textContent = message;
  elements.connectionMessage.classList.toggle("success", success);
}

function setSyncStatus(kind, message) {
  elements.syncStatus.className = `sync-status ${kind}`;
  elements.syncStatusText.textContent = message;
}

function showBusy(message) {
  elements.busyMessage.textContent = message;
  elements.busyOverlay.classList.remove("is-hidden");
}

function hideBusy() {
  elements.busyOverlay.classList.add("is-hidden");
}

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
  applyCover(elements.profilePreviewCover, pendingProfileBanner, false);
  setAvatar(elements.profilePreviewAvatar, pendingProfileAvatar, elements.profileNameInput.value || profile.name, false);
}

function openLightbox(source) {
  elements.lightboxImage.src = assetUrl(source);
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

function resetComposerAfterPost() {
  elements.postText.value = "";
  elements.youtubeInput.value = "";
  elements.charCount.textContent = String(MAX_TEXT_LENGTH);
  pendingImages = [];
  renderPendingImages();
}

function renderProfile() {
  elements.mobileProfileName.textContent = profile.name;
  elements.mobileProfileHandle.textContent = `@${profile.handle}`;
  elements.mobileProfileBio.textContent = profile.bio;
  applyCover(elements.mobileProfileCover, profile.banner);
  setAvatar(elements.mobileProfileAvatar, profile.avatar, profile.name);
  setAvatar(elements.composerAvatar, profile.avatar, profile.name);
}

function applyCover(element, source, resolveAsset = true) {
  element.style.backgroundImage = source ? `url("${resolveAsset ? assetUrl(source) : source}")` : "";
}

function setAvatar(element, source, name, resolveAsset = true) {
  element.replaceChildren();
  if (source) {
    const image = document.createElement("img");
    image.src = resolveAsset ? assetUrl(source) : source;
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
  time.dateTime = post.createdAt;
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
      image.src = assetUrl(source);
      image.alt = `投稿された写真 ${index + 1}`;
      image.loading = "lazy";
      button.append(image);
      grid.append(button);
    });
    body.append(grid);
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
    const edit = document.createElement("button");
    edit.className = "post-action";
    edit.type = "button";
    edit.dataset.action = "edit";
    edit.dataset.id = post.id;
    edit.textContent = "編集";
    const remove = document.createElement("button");
    remove.className = "post-action danger";
    remove.type = "button";
    remove.dataset.action = "delete";
    remove.dataset.id = post.id;
    remove.textContent = "削除";
    actions.append(edit, remove);
    body.append(actions);
  }

  article.append(avatar, body);
  return article;
}

function normalizeState(value) {
  const source = value && typeof value === "object" ? value : fallbackState;
  const sourceProfile = source.profile && typeof source.profile === "object" ? source.profile : fallbackState.profile;
  const normalizedProfile = {
    name: cleanString(sourceProfile.name, 30) || fallbackState.profile.name,
    handle: cleanString(sourceProfile.handle, 20) || fallbackState.profile.handle,
    bio: cleanString(sourceProfile.bio, 160),
    avatar: cleanAsset(sourceProfile.avatar),
    banner: cleanAsset(sourceProfile.banner)
  };

  const normalizedPosts = Array.isArray(source.posts)
    ? source.posts.slice(0, 500).map((post) => ({
        id: cleanString(post?.id, 80) || createId(),
        text: cleanString(post?.text, MAX_TEXT_LENGTH),
        images: Array.isArray(post?.images) ? post.images.map(cleanAsset).filter(Boolean).slice(0, MAX_IMAGES) : [],
        youtubeId: cleanYouTubeId(post?.youtubeId),
        createdAt: validDateString(post?.createdAt) || new Date().toISOString()
      }))
    : [];

  return {
    version: 1,
    updatedAt: validDateString(source.updatedAt) || new Date().toISOString(),
    profile: normalizedProfile,
    posts: normalizedPosts
  };
}

function cleanString(value, max) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function cleanAsset(value) {
  if (typeof value !== "string") return null;
  if (/^(data:image\/|https?:\/\/|[./]*media\/|[./]*sample-event\.svg$)/i.test(value)) return value;
  return null;
}

function validDateString(value) {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime()) ? value : "";
}

function assetUrl(source) {
  if (!source) return "";
  if (/^(data:|blob:|https?:\/\/)/i.test(source)) return source;
  const clean = source.replace(/^\.\//, "").replace(/^\//, "");
  return `./${clean}?v=${encodeURIComponent(state.updatedAt)}`;
}

function getPostImages(post) {
  return Array.isArray(post?.images) ? post.images : [];
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
  return typeof value === "string" && /^[A-Za-z0-9_-]{6,20}$/.test(value) ? value : null;
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

function formatSyncTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
}

async function compressImage(file, { max = 1280, quality = .78 } = {}) {
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

function utf8ToBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function base64ToUtf8(value) {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isDataImage(value) {
  return typeof value === "string" && value.startsWith("data:image/");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = window.setTimeout(() => elements.toast.classList.remove("show"), 3000);
}

const savedRole = sessionStorage.getItem(ROLE_KEY);
if (savedRole === "admin" || savedRole === "viewer") showApp(savedRole);
else showLogin();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
