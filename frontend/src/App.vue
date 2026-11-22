<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const token = ref(localStorage.getItem('token') || '');
const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));
const loginForm = ref({ username: '', password: '' });
const errorMsg = ref('');

const items = ref([]);
const newItem = ref({ name: '', description: '' });
const usersList = ref([]);

const authHeaders = () => ({
  headers: { Authorization: `Bearer ${token.value}` }
});

const handleLogin = async () => {
  errorMsg.value = '';
  try {
    const res = await axios.post(`${API_URL}/login`, loginForm.value);
    token.value = res.data.token;
    user.value = { username: res.data.username, role: res.data.role };
    localStorage.setItem('token', token.value);
    localStorage.setItem('user', JSON.stringify(user.value));
    loginForm.value = { username: '', password: '' };
    await loadData();
  } catch (err) {
    errorMsg.value = err.response?.data?.message || 'Gagal login';
  }
};

const handleLogout = () => {
  token.value = '';
  user.value = null;
  items.value = [];
  usersList.value = [];
  localStorage.clear();
};

const loadData = async () => {
  if (!token.value) return;
  try {
    const resItems = await axios.get(`${API_URL}/items`, authHeaders());
    items.value = resItems.data;

    if (user.value?.role === 'admin') {
      const resUsers = await axios.get(`${API_URL}/users`, authHeaders());
      usersList.value = resUsers.data;
    }
  } catch (err) {
    if (err.response?.status === 401) handleLogout();
  }
};

const addItem = async () => {
  if (!newItem.value.name) return;
  await axios.post(`${API_URL}/items`, newItem.value, authHeaders());
  newItem.value = { name: '', description: '' };
  await loadData();
};

const deleteItem = async (id) => {
  await axios.delete(`${API_URL}/items/${id}`, authHeaders());
  await loadData();
};

const toggleRole = async (targetUser) => {
  const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
  await axios.put(`${API_URL}/users/${targetUser.id}/role`, { role: newRole }, authHeaders());
  await loadData();
};

onMounted(() => {
  if (token.value) loadData();
});
</script>

<template>
  <div class="container">
    <div v-if="!token" class="card login-box">
      <h2>Login</h2>
      <p class="hint">
        Admin: <b>admin / admin123</b><br />
        User: <b>budi / user123</b>
      </p>
      <form @submit.prevent="handleLogin">
        <input v-model="loginForm.username" placeholder="Username" required />
        <input v-model="loginForm.password" type="password" placeholder="Password" required />
        <button type="submit">Masuk</button>
      </form>
      <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
    </div>

    <div v-else>
      <header class="topbar">
        <div>
          Halo, <strong>{{ user.username }}</strong>
          <span :class="['badge', user.role]">{{ user.role.toUpperCase() }}</span>
        </div>
        <button @click="handleLogout" class="btn-danger">Logout</button>
      </header>

      <div class="card">
        <h3>Data Inventaris</h3>
        <form v-if="user.role === 'admin'" @submit.prevent="addItem" class="inline-form">
          <input v-model="newItem.name" placeholder="Nama Barang" required />
          <input v-model="newItem.description" placeholder="Keterangan" />
          <button type="submit">Tambah</button>
        </form>

        <table>
          <thead>
            <tr>
              <th>Nama</th>
              <th>Keterangan</th>
              <th v-if="user.role === 'admin'">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="item.id">
              <td>{{ item.name }}</td>
              <td>{{ item.description }}</td>
              <td v-if="user.role === 'admin'">
                <button @click="deleteItem(item.id)" class="btn-danger btn-sm">Hapus</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="user.role === 'admin'" class="card">
        <h3>Pengaturan Hak Akses</h3>
        <table>
          <thead>
            <tr>
              <th>Username</th>
              <th>Role</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="u in usersList" :key="u.id">
              <td>{{ u.username }}</td>
              <td>{{ u.role }}</td>
              <td>
                <button
                  v-if="u.username !== user.username"
                  @click="toggleRole(u)"
                  class="btn-sm"
                >
                  Ubah ke {{ u.role === 'admin' ? 'User' : 'Admin' }}
                </button>
                <span v-else>(Akun Anda)</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.container { max-width: 720px; margin: 30px auto; font-family: sans-serif; padding: 15px; }
.card { background: #fff; border: 1px solid #ddd; padding: 20px; border-radius: 6px; margin-bottom: 20px; }
.login-box { max-width: 320px; margin: 50px auto; }
input { width: 100%; padding: 8px; margin: 6px 0; box-sizing: border-box; border: 1px solid #ccc; border-radius: 4px; }
button { padding: 8px 12px; background: #27ae60; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
.btn-danger { background: #c0392b; }
.btn-sm { padding: 4px 8px; font-size: 12px; }
.inline-form { display: flex; gap: 8px; margin-bottom: 10px; }
table { width: 100%; border-collapse: collapse; margin-top: 10px; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f9f9f9; }
.badge { padding: 2px 6px; border-radius: 10px; font-size: 11px; color: #fff; margin-left: 6px; }
.badge.admin { background: #2c3e50; }
.badge.user { background: #7f8c8d; }
.error { color: #c0392b; font-size: 13px; }
.hint { background: #ecf0f1; padding: 8px; font-size: 12px; border-radius: 4px; }
.topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; background: #fdfdfd; padding: 10px; border: 1px solid #ddd; border-radius: 6px; }
</style>