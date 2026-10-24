"use client";

import type { User } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/client";
import { formatDistanceToNow } from "date-fns";
import { Check, Edit2, Loader2, Plus, RefreshCw, Shield, Trash2, User as UserIcon, Users, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

interface Props {
  users: User[];
  currentUserId: string;
}

export default function UsersView({ users: initialUsers, currentUserId }: Props) {
  const t = useT();
  const [userList, setUserList] = useState(initialUsers);
  const [showAdd, setShowAdd] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", email: "", role: "user" as "admin" | "user", maxGrabsPerDay: 20 });
  const [saving, setSaving] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    email: "",
    maxGrabsPerDay: 20,
    maxDownloadsPerDay: 0,
    canGrab: true,
    canDownload: true,
    canUploadNzb: false,
    canPickDownloader: false,
    maxManualNzbPerDay: 0,
    password: "",
    ignoreSyncedLimits: false,
    emailVerified: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllOpen, setSyncAllOpen] = useState(false);
  const [syncAllSource, setSyncAllSource] = useState<"jellyfin" | "seerr">("jellyfin");
  const [syncTarget, setSyncTarget] = useState<User | null>(null);
  const [syncSource, setSyncSource] = useState<"jellyfin" | "seerr">("jellyfin");

  async function openEdit(user: User) {
    setEditUser(user);
    setEditForm({
      email: user.email ?? "",
      maxGrabsPerDay: user.maxGrabsPerDay ?? 0,
      maxDownloadsPerDay: user.maxDownloadsPerDay ?? 0,
      canGrab: user.canGrab ?? true,
      canDownload: user.canDownload ?? true,
      canUploadNzb: user.canUploadNzb ?? false,
      canPickDownloader: user.canPickDownloader ?? false,
      maxManualNzbPerDay: user.maxManualNzbPerDay ?? 0,
      password: "",
      ignoreSyncedLimits: user.ignoreSyncedLimits ?? false,
      emailVerified: user.emailVerified ?? false,
    });
  }

  async function syncAllUsers(source: "jellyfin" | "seerr") {
    setSyncingAll(true);
    setSyncAllOpen(false);
    try {
      const response = await fetch("/api/users/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = (await response.json()) as {
        error?: string;
        synced?: number;
        total?: number;
        source?: string;
        errors?: string[];
      };
      if (!response.ok) throw new Error(data.error ?? t("users.syncFailed"));

      const refresh = await fetch("/api/users");
      if (refresh.ok) {
        const refreshed = (await refresh.json()) as { users: User[] };
        setUserList(refreshed.users ?? userList);
      }

      toast.success(
        t("users.syncedCount", {
          synced: data.synced ?? 0,
          total: data.total ?? 0,
          source: data.source ?? source,
        }),
      );
      if (data.errors?.length) {
        toast.warning(t("users.syncPartialErrors", { count: data.errors.length }));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.syncFailed"));
    } finally {
      setSyncingAll(false);
    }
  }

  async function syncUser(user: User, source: "jellyfin" | "seerr") {
    setSyncingId(user.id);
    try {
      const response = await fetch(`/api/users/${user.id}/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      const data = (await response.json()) as { error?: string; email?: string; avatarUrl?: string };
      if (!response.ok) throw new Error(data.error ?? t("users.syncFailed"));
      setUserList((prev) =>
        prev.map((u) =>
          u.id === user.id
            ? {
                ...u,
                email: data.email ?? u.email,
                avatarUrl: data.avatarUrl ?? null,
                imported: true,
              }
            : u,
        ),
      );
      const parts = [t("users.syncedUser", { username: user.username, source })];
      if (data.email) parts.push(t("users.emailUpdated"));
      if (data.avatarUrl) parts.push(t("users.avatarUpdated"));
      toast.success(parts.join(" — "));
      setSyncTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("users.syncFailed"));
    } finally {
      setSyncingId(null);
    }
  }

  async function saveEdit() {
    if (!editUser) return;
    setSavingEdit(true);
    try {
      const response = await fetch(`/api/users/${editUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editForm.email.trim() || null,
          maxGrabsPerDay: editForm.maxGrabsPerDay,
          maxDownloadsPerDay: editForm.maxDownloadsPerDay,
          canGrab: editForm.canGrab,
          canDownload: editForm.canDownload,
          canUploadNzb: editForm.canUploadNzb,
          canPickDownloader: editForm.canPickDownloader,
          maxManualNzbPerDay: editForm.maxManualNzbPerDay,
          ignoreSyncedLimits: editForm.ignoreSyncedLimits,
          emailVerified: editForm.emailVerified,
          ...(editForm.password ? { password: editForm.password } : {}),
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(
          data.error ??
            (response.status === 422 ? t("users.invalidData") : t("users.updateFailed")),
        );
        return;
      }
      setUserList((prev) =>
        prev.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                email: editForm.email.trim() || null,
                maxGrabsPerDay: editForm.maxGrabsPerDay,
                maxDownloadsPerDay: editForm.maxDownloadsPerDay,
                canGrab: editForm.canGrab,
                canDownload: editForm.canDownload,
                canUploadNzb: editForm.canUploadNzb,
                canPickDownloader: editForm.canPickDownloader,
                maxManualNzbPerDay: editForm.maxManualNzbPerDay,
                ignoreSyncedLimits: editForm.ignoreSyncedLimits,
                emailVerified: editForm.emailVerified,
              }
            : u,
        ),
      );
      toast.success(editForm.password ? t("users.userUpdatedPassword") : t("users.userUpdated"));
      setEditUser(null);
    } catch {
      toast.error(t("users.updateFailed"));
    } finally {
      setSavingEdit(false);
    }
  }

  async function addUser() {
    if (!newUser.username || !newUser.password) {
      toast.error(t("users.usernamePasswordRequired"));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: newUser.username,
          password: newUser.password,
          role: newUser.role,
          maxGrabsPerDay: newUser.maxGrabsPerDay,
          ...(newUser.email.trim() ? { email: newUser.email.trim() } : {}),
        }),
      });
      const data = await response.json() as { user?: User; error?: string };
      if (!response.ok) {
        toast.error(data.error ?? t("users.createFailed"));
        return;
      }
      setUserList((prev) => [...prev, data.user!]);
      setShowAdd(false);
      setNewUser({ username: "", password: "", email: "", role: "user", maxGrabsPerDay: 20 });
      toast.success(t("users.userCreated"));
    } catch {
      toast.error(t("users.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!response.ok) throw new Error();
      setUserList((prev) => prev.map((u) => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
      toast.success(user.isActive ? t("users.userDisabled") : t("users.userEnabled"));
    } catch {
      toast.error(t("users.updateFailed"));
    }
  }

  async function toggleRole(user: User) {
    if (user.id === currentUserId) {
      toast.error(t("users.cannotChangeOwnRole"));
      return;
    }
    const newRole = user.role === "admin" ? "user" : "admin";
    const confirmKey = newRole === "admin" ? "users.promoteConfirm" : "users.demoteConfirm";
    if (!confirm(t(confirmKey, { username: user.username }))) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });
      if (!response.ok) throw new Error();
      setUserList((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)),
      );
      toast.success(
        t(newRole === "admin" ? "users.promoted" : "users.demoted", { username: user.username }),
      );
    } catch {
      toast.error(t("users.roleUpdateFailed"));
    }
  }

  async function deleteUser(user: User) {
    if (user.id === currentUserId) {
      toast.error(t("users.cannotDeleteSelf"));
      return;
    }
    if (!confirm(t("users.deleteConfirm", { username: user.username }))) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setUserList((prev) => prev.filter((u) => u.id !== user.id));
      toast.success(t("users.userDeleted"));
    } catch {
      toast.error(t("users.deleteFailed"));
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          {t("users.title")}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSyncAllOpen(true)}
            disabled={syncingAll}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            title={t("users.syncAllTitleBtn")}
          >
            {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("users.syncAll")}
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            {t("users.addUser")}
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="nv-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">{t("users.newUser")}</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("users.usernameRequired")}</label>
              <input
                className="nv-input w-full"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder={t("users.usernamePlaceholder")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("users.passwordRequired")}</label>
              <input
                className="nv-input w-full"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder={t("users.passwordMin")}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("auth.emailOptional")}</label>
              <input
                className="nv-input w-full"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder={t("auth.emailPlaceholder")}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("common.role")}</label>
              <select className="nv-input w-full" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "user" })}>
                <option value="user">{t("users.roleUser")}</option>
                <option value="admin">{t("users.roleAdmin")}</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("users.maxGrabsDayUnlimited")}</label>
              <input
                className="nv-input w-full"
                type="number"
                min={0}
                value={newUser.maxGrabsPerDay}
                onChange={(e) => setNewUser({ ...newUser, maxGrabsPerDay: parseInt(e.target.value) })}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
              {t("common.cancel")}
            </button>
            <button
              onClick={addUser}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {t("users.createUser")}
            </button>
          </div>
        </div>
      )}

      <div className="nv-card overflow-hidden">
        <table className="nv-table">
          <thead>
            <tr>
              <th>{t("common.user")}</th>
              <th>{t("common.role")}</th>
              <th className="hidden lg:table-cell">{t("users.auth")}</th>
              <th className="hidden md:table-cell">{t("users.grabsDay")}</th>
              <th className="hidden md:table-cell">{t("users.lastLogin")}</th>
              <th>{t("common.status")}</th>
              <th className="text-right">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {userList.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="flex items-center gap-2">
                    <UserAvatar user={user} />
                    <div>
                      <p className="text-sm font-medium">{user.username}</p>
                      {user.email && <p className="text-xs text-muted-foreground">{user.email}</p>}
                    </div>
                    {user.id === currentUserId && (
                      <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                        {t("users.you")}
                      </span>
                    )}
                  </div>
                </td>
                <td>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    user.role === "admin"
                      ? "bg-purple-500/15 text-purple-400"
                      : "bg-muted text-muted-foreground",
                  )}>
                    {user.role === "admin" ? <Shield className="inline h-3 w-3 mr-1" /> : <UserIcon className="inline h-3 w-3 mr-1" />}
                    {user.role === "admin" ? t("users.roleAdmin") : t("users.roleUser")}
                  </span>
                </td>
                <td className="hidden lg:table-cell">
                  {user.imported ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                      {t("users.syncedExternal")}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="hidden md:table-cell text-sm text-muted-foreground">
                  {user.maxGrabsPerDay === 0 ? "∞" : user.maxGrabsPerDay}
                </td>
                <td className="hidden md:table-cell text-sm text-muted-foreground">
                  {user.lastLoginAt
                    ? formatDistanceToNow(new Date(user.lastLoginAt), { addSuffix: true })
                    : t("common.never")}
                </td>
                <td>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    user.isActive
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400",
                  )}>
                    {user.isActive ? t("common.active") : t("common.disabled")}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={user.id === currentUserId}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      title={user.isActive ? t("users.disableUser") : t("users.enableUser")}
                    >
                      {user.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-400" />}
                    </button>
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={user.id === currentUserId}
                      className={cn(
                        "p-1.5 transition-colors disabled:opacity-30",
                        user.role === "admin"
                          ? "text-purple-400 hover:text-muted-foreground"
                          : "text-muted-foreground hover:text-purple-400",
                      )}
                      title={user.role === "admin" ? t("users.demoteUser") : t("users.promoteAdmin")}
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setSyncTarget(user); setSyncSource("jellyfin"); }}
                      disabled={syncingId === user.id}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                      title={t("users.manualSync")}
                    >
                      <RefreshCw className={cn("h-4 w-4", syncingId === user.id && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      title={t("common.edit")}
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={user.id === currentUserId}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                      title={t("users.deleteUserTitle")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {syncAllOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSyncAllOpen(false)}>
          <div className="nv-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">{t("users.syncAllTitle")}</h2>
            <p className="text-sm text-muted-foreground">{t("users.syncAllHint")}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 border border-border rounded-md cursor-pointer hover:border-primary/40">
                <input type="radio" name="syncAllSource" checked={syncAllSource === "jellyfin"} onChange={() => setSyncAllSource("jellyfin")} />
                <span className="text-sm">Jellyfin</span>
              </label>
              <label className="flex items-center gap-2 p-3 border border-border rounded-md cursor-pointer hover:border-primary/40">
                <input type="radio" name="syncAllSource" checked={syncAllSource === "seerr"} onChange={() => setSyncAllSource("seerr")} />
                <span className="text-sm">Seerr</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSyncAllOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => void syncAllUsers(syncAllSource)}
                disabled={syncingAll}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("users.syncAll")}
              </button>
            </div>
          </div>
        </div>
      )}

      {syncTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSyncTarget(null)}>
          <div className="nv-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">{t("users.syncUser", { username: syncTarget.username })}</h2>
            <p className="text-sm text-muted-foreground">{t("users.syncChooseApp")}</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-3 border border-border rounded-md cursor-pointer hover:border-primary/40">
                <input type="radio" name="syncSource" checked={syncSource === "jellyfin"} onChange={() => setSyncSource("jellyfin")} />
                <span className="text-sm">Jellyfin</span>
              </label>
              <label className="flex items-center gap-2 p-3 border border-border rounded-md cursor-pointer hover:border-primary/40">
                <input type="radio" name="syncSource" checked={syncSource === "seerr"} onChange={() => setSyncSource("seerr")} />
                <span className="text-sm">Seerr</span>
              </label>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setSyncTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                {t("common.cancel")}
              </button>
              <button
                onClick={() => syncUser(syncTarget, syncSource)}
                disabled={syncingId === syncTarget.id}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {syncingId === syncTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("users.sync")}
              </button>
            </div>
          </div>
        </div>
      )}

      {editUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEditUser(null)}
        >
          <div
            className="nv-card w-full max-w-md p-5 space-y-4 animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-primary" />
                {t("users.editUser", { username: editUser.username })}
              </h2>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("auth.email")}</label>
              <input
                className="nv-input w-full"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder={t("auth.emailPlaceholder")}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">{t("users.passwordKeep")}</label>
              <input
                className="nv-input w-full"
                type="password"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                placeholder="••••••••"
                autoComplete="new-password"
              />
            </div>

            {editUser.imported && (
              <div className="rounded-md border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-300">
                {t("users.syncedExternal")}
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.emailApproved")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.emailApprovedDesc")}</p>
                </div>
                <EditToggle
                  checked={editForm.emailVerified}
                  onChange={() => setEditForm({ ...editForm, emailVerified: !editForm.emailVerified })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.grabPermission")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.grabPermissionDesc")}</p>
                </div>
                <EditToggle checked={editForm.canGrab} onChange={() => setEditForm({ ...editForm, canGrab: !editForm.canGrab })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.downloadPermission")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.downloadPermissionDesc")}</p>
                </div>
                <EditToggle checked={editForm.canDownload} onChange={() => setEditForm({ ...editForm, canDownload: !editForm.canDownload })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.manualNzbUpload")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.manualNzbUploadDesc")}</p>
                </div>
                <EditToggle
                  checked={editForm.canUploadNzb}
                  onChange={() => setEditForm({ ...editForm, canUploadNzb: !editForm.canUploadNzb })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.pickDownloader")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.pickDownloaderDesc")}</p>
                </div>
                <EditToggle
                  checked={editForm.canPickDownloader}
                  onChange={() => setEditForm({ ...editForm, canPickDownloader: !editForm.canPickDownloader })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t("users.customLimits")}</p>
                  <p className="text-xs text-muted-foreground">{t("users.customLimitsDesc")}</p>
                </div>
                <EditToggle
                  checked={editForm.ignoreSyncedLimits}
                  onChange={() => setEditForm({ ...editForm, ignoreSyncedLimits: !editForm.ignoreSyncedLimits })}
                />
              </div>
            </div>

            {editForm.canUploadNzb && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("users.manualNzbLimit")}</label>
                <input
                  className="nv-input w-full"
                  type="number"
                  min={0}
                  value={editForm.maxManualNzbPerDay}
                  onChange={(e) =>
                    setEditForm({ ...editForm, maxManualNzbPerDay: parseInt(e.target.value) || 0 })
                  }
                />
              </div>
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("users.maxGrabsDayUnlimited")}</label>
                <input
                  className="nv-input w-full"
                  type="number"
                  min={0}
                  value={editForm.maxGrabsPerDay}
                  onChange={(e) => setEditForm({ ...editForm, maxGrabsPerDay: parseInt(e.target.value) || 0 })}
                  placeholder={t("users.grabLimitPlaceholder")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">{t("users.maxDownloadsDayUnlimited")}</label>
                <input
                  className="nv-input w-full"
                  type="number"
                  min={0}
                  value={editForm.maxDownloadsPerDay}
                  onChange={(e) => setEditForm({ ...editForm, maxDownloadsPerDay: parseInt(e.target.value) || 0 })}
                  placeholder={t("users.downloadLimitPlaceholder")}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                {t("common.cancel")}
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit || (!!editForm.password && editForm.password.length < 8)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserAvatar({ user }: { user: User }) {
  const [failed, setFailed] = useState(false);
  const showImage = user.avatarUrl && !failed;

  if (showImage) {
    return (
      <Image
        src={user.avatarUrl!}
        alt=""
        width={28}
        height={28}
        unoptimized
        className="w-7 h-7 rounded-full object-cover shrink-0 bg-muted"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
      <span className="text-xs font-semibold text-primary uppercase">{user.username.charAt(0)}</span>
    </div>
  );
}

function EditToggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={cn(
        "relative w-10 h-5 rounded-full transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        checked ? "bg-primary" : "bg-muted",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform shadow",
          checked && "translate-x-5",
        )}
      />
    </button>
  );
}
