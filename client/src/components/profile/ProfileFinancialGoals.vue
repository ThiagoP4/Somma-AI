<template>
    <div class="profile-card">
        <h2>Metas Financeiras</h2>
        <form class="profile-card-content" @submit.prevent>
            <div class="form-grid">
                <div class="profile-card-content-item full-width">
                    <label for="goals">Minhas metas</label>
                    <input type="text" id="goals" disabled placeholder="Módulo em Breve...">
                </div>
            </div>
            <button class="btn-apply" type="button" @click="$emit('save')">Salvar Meta</button>
        </form>
    </div>
</template>

<style scoped>
    .profile-card { background: var(--bg-card); border-radius: 1rem; padding: 2rem; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
    .profile-card h2 { color: var(--text-primary); font-size: 1.25rem; margin: 0 0 1.5rem 0; font-weight: 600; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color); }
    .form-grid { display: flex; flex-direction: column; gap: 1.5rem; }
    .profile-card-content-item { display: flex; flex-direction: column; gap: 0.5rem; }
    .profile-card-content-item label { color: var(--text-secondary); font-size: 0.9rem; font-weight: 500; }
    .profile-card-content-item input { background: transparent; border: 1px solid var(--border-color); color: var(--text-primary); padding: 0.8rem; border-radius: 6px; font-size: 1rem; transition: border-color 0.2s; }
    .profile-card-content-item input:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-apply { margin-top: 1.5rem; background-color: var(--primary-color); color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; align-self: flex-start; }
</style>
