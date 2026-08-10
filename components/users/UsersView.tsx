"use client";

import type { User } from "@/lib/db/schema";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { Check, Edit2, Loader2, Plus, RefreshCw, Shield, Trash2, User as UserIcon, Users, X } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { toast } from "sonner";

const EXTERNAL_AUTH_SYNC_LABEL = "Synced with external auth";

interface Props {
  users: User[];
  currentUserId: string;
}

export default function UsersView({ users: initialUsers, currentUserId }: Props) {
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
  const [editUsage, setEditUsage] = useState<{
    grabsToday: number;
    downloadsToday: number;
    grabMax: number;
    downloadMax: number;
    grabsLeft: number | null;
    downloadsLeft: number | null;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncAllOpen, setSyncAllOpen] = useState(false);
  const [syncAllSource, setSyncAllSource] = useState<"jellyfin" | "seerr">("jellyfin");
  const [syncTarget, setSyncTarget] = useState<User | null>(null);
  const [syncSource, setSyncSource] = useState<"jellyfin" | "seerr">("jellyfin");

  async function openEdit(user: User) {
    setEditUser(user);
    setEditUsage(null);
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
    try {
      const res = await fetch(`/api/users/${user.id}`);
      if (res.ok) {
        const data = (await res.json()) as {
          usage?: typeof editUsage;
        };
        if (data.usage) setEditUsage(data.usage);
      }
    } catch {
      /* usage display optional */
    }
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
      if (!response.ok) throw new Error(data.error ?? "Sync failed");

      const refresh = await fetch("/api/users");
      if (refresh.ok) {
        const refreshed = (await refresh.json()) as { users: User[] };
        setUserList(refreshed.users ?? userList);
      }

      toast.success(`Synced ${data.synced ?? 0}/${data.total ?? 0} users from ${data.source ?? source}`);
      if (data.errors?.length) {
        toast.warning(`${data.errors.length} user(s) could not be synced`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
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
      if (!response.ok) throw new Error(data.error ?? "Sync failed");
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
      const parts = [`Synced ${user.username} from ${source}`];
      if (data.email) parts.push("email updated");
      if (data.avatarUrl) parts.push("avatar updated");
      toast.success(parts.join(" — "));
      setSyncTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
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
        toast.error(data.error ?? (response.status === 422 ? "Invalid data (check email / password ≥ 8 chars)" : "Failed to update user"));
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
      toast.success(editForm.password ? "User updated (password reset)" : "User updated");
      setEditUser(null);
    } catch {
      toast.error("Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  }

  async function addUser() {
    if (!newUser.username || !newUser.password) {
      toast.error("Username and password are required");
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
          // Email is optional for admin-created users — only send when provided.
          ...(newUser.email.trim() ? { email: newUser.email.trim() } : {}),
        }),
      });
      const data = await response.json() as { user?: User; error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to create user");
        return;
      }
      setUserList((prev) => [...prev, data.user!]);
      setShowAdd(false);
      setNewUser({ username: "", password: "", email: "", role: "user", maxGrabsPerDay: 20 });
      toast.success("User created");
    } catch {
      toast.error("Failed to create user");
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
      toast.success(user.isActive ? "User disabled" : "User enabled");
    } catch {
      toast.error("Failed to update user");
    }
  }

  async function toggleRole(user: User) {
    if (user.id === currentUserId) {
      toast.error("Cannot change your own role");
      return;
    }
    const newRole = user.role === "admin" ? "user" : "admin";
    const label = newRole === "admin" ? "promote to Admin" : "demote to User";
    if (!confirm(`${label.charAt(0).toUpperCase() + label.slice(1)} "${user.username}"?`)) return;
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
      toast.success(`"${user.username}" ${label}d`);
    } catch {
      toast.error("Failed to update role");
    }
  }

  async function deleteUser(user: User) {
    if (user.id === currentUserId) {
      toast.error("Cannot delete your own account");
      return;
    }
    if (!confirm(`Delete user "${user.username}"? This cannot be undone.`)) return;
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setUserList((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("User deleted");
    } catch {
      toast.error("Failed to delete user");
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Users
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSyncAllOpen(true)}
            disabled={syncingAll}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-md text-sm font-medium hover:bg-accent transition-colors disabled:opacity-50"
            title="Sync all users from Jellyfin or Seerr"
          >
            {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sync All
          </button>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add User
          </button>
        </div>
      </div>

      {/* Add user form */}
      {showAdd && (
        <div className="nv-card p-5 space-y-4">
          <h2 className="text-sm font-semibold">New User</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Username *</label>
              <input
                className="nv-input w-full"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                placeholder="username"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Password *</label>
              <input
                className="nv-input w-full"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Min 8 characters"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email (optional)</label>
              <input
                className="nv-input w-full"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="you@example.com"
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Role</label>
              <select className="nv-input w-full" value={newUser.role} onChange={(e) => setNewUser({ ...newUser, role: e.target.value as "admin" | "user" })}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Max Grabs/Day (0 = unlimited)</label>
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
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button
              onClick={addUser}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create User
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="nv-card overflow-hidden">
        <table className="nv-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th className="hidden lg:table-cell">Auth</th>
              <th className="hidden md:table-cell">Grabs/Day</th>
              <th className="hidden md:table-cell">Last Login</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
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
                      <span className="text-xs bg-primary/15 text-primary px-1.5 py-0.5 rounded">You</span>
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
                    {user.role}
                  </span>
                </td>
                <td className="hidden lg:table-cell">
                  {user.imported ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">
                      {EXTERNAL_AUTH_SYNC_LABEL}
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
                    : "Never"}
                </td>
                <td>
                  <span className={cn(
                    "text-xs font-medium px-2 py-0.5 rounded-full",
                    user.isActive
                      ? "bg-green-500/15 text-green-400"
                      : "bg-red-500/15 text-red-400",
                  )}>
                    {user.isActive ? "Active" : "Disabled"}
                  </span>
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(user)}
                      disabled={user.id === currentUserId}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
                      title={user.isActive ? "Disable user" : "Enable user"}
                    >
                      {user.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-400" />}
                    </button>
                    {/* Promote / demote admin role */}
                    <button
                      onClick={() => toggleRole(user)}
                      disabled={user.id === currentUserId}
                      className={cn(
                        "p-1.5 transition-colors disabled:opacity-30",
                        user.role === "admin"
                          ? "text-purple-400 hover:text-muted-foreground"
                          : "text-muted-foreground hover:text-purple-400",
                      )}
                      title={user.role === "admin" ? "Demote to User" : "Promote to Admin"}
                    >
                      <Shield className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => { setSyncTarget(user); setSyncSource("jellyfin"); }}
                      disabled={syncingId === user.id}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                      title="Manual sync from app"
                    >
                      <RefreshCw className={cn("h-4 w-4", syncingId === user.id && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => openEdit(user)}
                      className="p-1.5 text-muted-foreground hover:text-primary transition-colors"
                      title="Edit user"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={user.id === currentUserId}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                      title="Delete user"
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
            <h2 className="text-base font-semibold">Sync All Users</h2>
            <p className="text-sm text-muted-foreground">Choose which app to sync profile data (email, avatar) from.</p>
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
              <button onClick={() => setSyncAllOpen(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={() => void syncAllUsers(syncAllSource)}
                disabled={syncingAll}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {syncingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync All
              </button>
            </div>
          </div>
        </div>
      )}

      {syncTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSyncTarget(null)}>
          <div className="nv-card w-full max-w-sm p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Sync {syncTarget.username}</h2>
            <p className="text-sm text-muted-foreground">Choose which app to sync profile data from.</p>
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
              <button onClick={() => setSyncTarget(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
              <button
                onClick={() => syncUser(syncTarget, syncSource)}
                disabled={syncingId === syncTarget.id}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm disabled:opacity-50"
              >
                {syncingId === syncTarget.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit user modal */}
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
                Edit {editUser.username}
              </h2>
              <button onClick={() => setEditUser(null)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Email</label>
              <input
                className="nv-input w-full"
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">Password (min 8 chars, leave empty to keep)</label>
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
                {EXTERNAL_AUTH_SYNC_LABEL}
              </div>
            )}

            <div className="space-y-3 border-t border-border pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Email approved</p>
                  <p className="text-xs text-muted-foreground">Allow access when email verification is required</p>
                </div>
                <EditToggle
                  checked={editForm.emailVerified}
                  onChange={() => setEditForm({ ...editForm, emailVerified: !editForm.emailVerified })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Grab Permission</p>
                  <p className="text-xs text-muted-foreground">Allow searching &amp; grabbing</p>
                </div>
                <EditToggle checked={editForm.canGrab} onChange={() => setEditForm({ ...editForm, canGrab: !editForm.canGrab })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Download Permission</p>
                  <p className="text-xs text-muted-foreground">Allow downloading finished files</p>
                </div>
                <EditToggle checked={editForm.canDownload} onChange={() => setEditForm({ ...editForm, canDownload: !editForm.canDownload })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Manual NZB upload</p>
                  <p className="text-xs text-muted-foreground">Shows Upload NZB menu and allows queueing NZBs</p>
                </div>
                <EditToggle
                  checked={editForm.canUploadNzb}
                  onChange={() => setEditForm({ ...editForm, canUploadNzb: !editForm.canUploadNzb })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Pick download client</p>
                  <p className="text-xs text-muted-foreground">Choose which client receives grabs (requires global setting)</p>
                </div>
                <EditToggle
                  checked={editForm.canPickDownloader}
                  onChange={() => setEditForm({ ...editForm, canPickDownloader: !editForm.canPickDownloader })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Custom limits (ignore global sync)</p>
                  <p className="text-xs text-muted-foreground">Global default grabs/day won&apos;t overwrite this user&apos;s limits</p>
                </div>
                <EditToggle
                  checked={editForm.ignoreSyncedLimits}
                  onChange={() => setEditForm({ ...editForm, ignoreSyncedLimits: !editForm.ignoreSyncedLimits })}
                />
              </div>
            </div>

            {editForm.canUploadNzb && (
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Manual NZB limit / day (0 = ∞)</label>
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
                <label className="text-xs text-muted-foreground">Grabs today</label>
                <p className="text-sm font-medium tabular-nums">
                  {editUsage
                    ? `${editUsage.grabsToday} used · ${editUsage.grabsLeft ?? "∞"} left (limit ${editUsage.grabMax || "∞"}/day)`
                    : "—"}
                </p>
                <input
                  className="nv-input w-full"
                  type="number"
                  min={0}
                  value={editForm.maxGrabsPerDay}
                  onChange={(e) => setEditForm({ ...editForm, maxGrabsPerDay: parseInt(e.target.value) || 0 })}
                  placeholder="Daily grab limit (0 = ∞)"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Downloads today</label>
                <p className="text-sm font-medium tabular-nums">
                  {editUsage
                    ? `${editUsage.downloadsToday} used · ${editUsage.downloadsLeft ?? "∞"} left (limit ${editUsage.downloadMax || "∞"}/day)`
                    : "—"}
                </p>
                <input
                  className="nv-input w-full"
                  type="number"
                  min={0}
                  value={editForm.maxDownloadsPerDay}
                  onChange={(e) => setEditForm({ ...editForm, maxDownloadsPerDay: parseInt(e.target.value) || 0 })}
                  placeholder="Daily download limit (0 = ∞)"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setEditUser(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={savingEdit || (!!editForm.password && editForm.password.length < 8)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Save
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
