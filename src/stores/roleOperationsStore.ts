import { computed, ref } from 'vue';
import { defineStore } from 'pinia';
import { deleteEntity, loadRoleOperationsSnapshot, pruneUnusedStoredMediaCache, putEntity } from '@/data/db';
import type { AppSnapshot } from '@/types/domain';
import type { RoleContentDraft, RoleOperationAuditEntry, RoleOperationPolicy, RoleOutboundTask, RoleSocialAccount, UserSocialAccount } from '@/types/roleOperations';

export const useRoleOperationsStore = defineStore('role-operations', () => {
  const ready = ref(false);
  let hydratePromise: Promise<void> | null = null;
  const accounts = ref<RoleSocialAccount[]>([]);
  const userAccounts = ref<UserSocialAccount[]>([]);
  const drafts = ref<RoleContentDraft[]>([]);
  const tasks = ref<RoleOutboundTask[]>([]);
  const policies = ref<RoleOperationPolicy[]>([]);
  const audits = ref<RoleOperationAuditEntry[]>([]);

  const pendingTasks = computed(() => tasks.value
    .filter((task) => ['awaiting-approval', 'scheduled', 'failed', 'blocked'].includes(task.status))
    .sort((left, right) => (left.scheduledAt ?? left.createdAt) - (right.scheduledAt ?? right.createdAt)));

  function applySnapshot(snapshot: Pick<AppSnapshot, 'roleSocialAccounts' | 'userSocialAccounts' | 'roleContentDrafts' | 'roleOutboundTasks' | 'roleOperationPolicies' | 'roleOperationAudits'>) {
    accounts.value = snapshot.roleSocialAccounts ?? [];
    userAccounts.value = snapshot.userSocialAccounts ?? [];
    drafts.value = snapshot.roleContentDrafts ?? [];
    tasks.value = snapshot.roleOutboundTasks ?? [];
    policies.value = snapshot.roleOperationPolicies ?? [];
    audits.value = snapshot.roleOperationAudits ?? [];
    ready.value = true;
  }

  async function ensureReady() {
    if (ready.value) return;
    if (hydratePromise) return hydratePromise;
    hydratePromise = loadRoleOperationsSnapshot().then(applySnapshot).finally(() => {
      hydratePromise = null;
    });
    return hydratePromise;
  }

  function accountsForCharacter(characterId: string) {
    return accounts.value.filter((account) => account.characterId === characterId);
  }

  function userAccountsForUser(userId: string, characterId?: string) {
    return userAccounts.value.filter((account) => account.userId === userId && (!characterId || account.characterIds.includes(characterId)));
  }

  function draftsForCharacter(characterId: string) {
    return drafts.value.filter((draft) => draft.characterId === characterId).sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function tasksForCharacter(characterId: string) {
    return tasks.value.filter((task) => task.characterId === characterId).sort((left, right) => right.updatedAt - left.updatedAt);
  }

  function auditsForCharacter(characterId: string) {
    return audits.value.filter((audit) => audit.characterId === characterId).sort((left, right) => right.createdAt - left.createdAt);
  }

  function policyForCharacter(characterId: string) {
    return policies.value.find((policy) => policy.characterId === characterId) ?? null;
  }

  async function saveAccount(account: RoleSocialAccount) {
    const index = accounts.value.findIndex((entry) => entry.id === account.id);
    if (index >= 0) accounts.value[index] = account;
    else accounts.value.push(account);
    await putEntity('roleSocialAccounts', account);
  }

  async function deleteAccount(accountId: string) {
    accounts.value = accounts.value.filter((account) => account.id !== accountId);
    await deleteEntity('roleSocialAccounts', accountId);
  }

  async function saveUserAccount(account: UserSocialAccount) {
    const index = userAccounts.value.findIndex((entry) => entry.id === account.id);
    if (index >= 0) userAccounts.value[index] = account;
    else userAccounts.value.push(account);
    await putEntity('userSocialAccounts', account);
  }

  async function deleteUserAccount(accountId: string) {
    userAccounts.value = userAccounts.value.filter((account) => account.id !== accountId);
    await deleteEntity('userSocialAccounts', accountId);
  }

  async function saveDraft(draft: RoleContentDraft) {
    const index = drafts.value.findIndex((entry) => entry.id === draft.id);
    if (index >= 0) drafts.value[index] = draft;
    else drafts.value.push(draft);
    await putEntity('roleContentDrafts', draft);
  }

  async function deleteDraft(draftId: string) {
    drafts.value = drafts.value.filter((draft) => draft.id !== draftId);
    await deleteEntity('roleContentDrafts', draftId);
  }

  async function saveTask(task: RoleOutboundTask) {
    const index = tasks.value.findIndex((entry) => entry.id === task.id);
    if (index >= 0) tasks.value[index] = task;
    else tasks.value.push(task);
    await putEntity('roleOutboundTasks', task);
  }

  async function deleteTask(taskId: string) {
    tasks.value = tasks.value.filter((task) => task.id !== taskId);
    await deleteEntity('roleOutboundTasks', taskId);
  }

  async function savePolicy(policy: RoleOperationPolicy) {
    const index = policies.value.findIndex((entry) => entry.characterId === policy.characterId);
    if (index >= 0) policies.value[index] = policy;
    else policies.value.push(policy);
    await putEntity('roleOperationPolicies', policy);
  }

  async function saveAudit(audit: RoleOperationAuditEntry) {
    audits.value.unshift(audit);
    if (audits.value.length > 1_000) audits.value.length = 1_000;
    await putEntity('roleOperationAudits', audit);
  }

  async function removeCharacterData(characterId: string) {
    const accountIds = new Set(accountsForCharacter(characterId).map((account) => account.id));
    const userAccountsToUpdate = userAccounts.value.filter((account) => account.characterIds.includes(characterId));
    const deleteIds = {
      accounts: [...accountIds],
      userAccounts: userAccountsToUpdate.filter((account) => account.characterIds.length === 1).map((account) => account.id),
      drafts: drafts.value.filter((entry) => entry.characterId === characterId).map((entry) => entry.id),
      tasks: tasks.value.filter((entry) => entry.characterId === characterId).map((entry) => entry.id),
      audits: audits.value.filter((entry) => entry.characterId === characterId).map((entry) => entry.id)
    };
    accounts.value = accounts.value.filter((entry) => entry.characterId !== characterId);
    userAccounts.value = userAccounts.value
      .filter((entry) => !deleteIds.userAccounts.includes(entry.id))
      .map((entry) => entry.characterIds.includes(characterId)
        ? { ...entry, characterIds: entry.characterIds.filter((id) => id !== characterId), updatedAt: Date.now() }
        : entry);
    drafts.value = drafts.value.filter((entry) => entry.characterId !== characterId);
    tasks.value = tasks.value.filter((entry) => entry.characterId !== characterId);
    policies.value = policies.value.filter((entry) => entry.characterId !== characterId);
    audits.value = audits.value.filter((entry) => entry.characterId !== characterId);
    await Promise.all([
      ...deleteIds.accounts.map((id) => deleteEntity('roleSocialAccounts', id)),
      ...deleteIds.userAccounts.map((id) => deleteEntity('userSocialAccounts', id)),
      ...userAccountsToUpdate.filter((account) => !deleteIds.userAccounts.includes(account.id)).map((account) => putEntity('userSocialAccounts', { ...account, characterIds: account.characterIds.filter((id) => id !== characterId), updatedAt: Date.now() })),
      ...deleteIds.drafts.map((id) => deleteEntity('roleContentDrafts', id)),
      ...deleteIds.tasks.map((id) => deleteEntity('roleOutboundTasks', id)),
      ...deleteIds.audits.map((id) => deleteEntity('roleOperationAudits', id)),
      deleteEntity('roleOperationPolicies', characterId)
    ]);
  }

  async function clearAllRoleOperationsData() {
    await ensureReady();
    const entries = {
      accounts: [...accounts.value],
      userAccounts: [...userAccounts.value],
      drafts: [...drafts.value],
      tasks: [...tasks.value],
      policies: [...policies.value],
      audits: [...audits.value]
    };
    accounts.value = [];
    userAccounts.value = [];
    drafts.value = [];
    tasks.value = [];
    policies.value = [];
    audits.value = [];
    await Promise.all([
      ...entries.accounts.map((entry) => deleteEntity('roleSocialAccounts', entry.id)),
      ...entries.userAccounts.map((entry) => deleteEntity('userSocialAccounts', entry.id)),
      ...entries.drafts.map((entry) => deleteEntity('roleContentDrafts', entry.id)),
      ...entries.tasks.map((entry) => deleteEntity('roleOutboundTasks', entry.id)),
      ...entries.policies.map((entry) => deleteEntity('roleOperationPolicies', entry.characterId)),
      ...entries.audits.map((entry) => deleteEntity('roleOperationAudits', entry.id))
    ]);
    await pruneUnusedStoredMediaCache();
    return entries.accounts.length + entries.userAccounts.length + entries.drafts.length + entries.tasks.length + entries.policies.length + entries.audits.length;
  }

  return {
    ready,
    accounts,
    userAccounts,
    drafts,
    tasks,
    policies,
    audits,
    pendingTasks,
    applySnapshot,
    ensureReady,
    accountsForCharacter,
    userAccountsForUser,
    draftsForCharacter,
    tasksForCharacter,
    auditsForCharacter,
    policyForCharacter,
    saveAccount,
    deleteAccount,
    saveUserAccount,
    deleteUserAccount,
    saveDraft,
    deleteDraft,
    saveTask,
    deleteTask,
    savePolicy,
    saveAudit,
    removeCharacterData,
    clearAllRoleOperationsData
  };
});