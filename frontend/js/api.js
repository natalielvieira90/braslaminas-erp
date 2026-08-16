const API = {
  BASE_URL: "/api",

  getToken() {
    return localStorage.getItem("braslaminas_token");
  },

  setToken(token) {
    localStorage.setItem("braslaminas_token", token);
  },

  clearToken() {
    localStorage.removeItem("braslaminas_token");
  },

  getUser() {
    try {
      return JSON.parse(localStorage.getItem("braslaminas_user"));
    } catch {
      return null;
    }
  },

  setUser(user) {
    localStorage.setItem("braslaminas_user", JSON.stringify(user));
  },

  clearUser() {
    localStorage.removeItem("braslaminas_user");
  },

  isAuthenticated() {
    return Boolean(this.getToken());
  },

  logout() {
    this.clearToken();
    this.clearUser();
  },

  async request(path, options = {}) {
    const headers = { ...options.headers };
    const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (!isForm && options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(this.BASE_URL + path, {
      ...options,
      headers,
      body: options.body
        ? isForm
          ? options.body
          : JSON.stringify(options.body)
        : undefined,
    });

    if (res.status === 204) {
      return null;
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const error = new Error(data.error || "Erro na requisição.");
      error.status = res.status;
      error.details = data.details;
      throw error;
    }

    return data;
  },

  get(path) {
    return this.request(path);
  },

  post(path, body) {
    return this.request(path, { method: "POST", body });
  },

  put(path, body) {
    return this.request(path, { method: "PUT", body });
  },

  del(path) {
    return this.request(path, { method: "DELETE" });
  },

  uploadImage(file) {
    const form = new FormData();
    form.append("image", file);
    return this.request("/upload/image", { method: "POST", body: form });
  },
};
