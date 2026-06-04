"use client";

import { useState } from "react";
import { Users, Plus, Edit2, Trash2, Loader2, Shield, User as UserIcon, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { User } from "@/lib/db/schema";
import { formatDistanceToNow } from "date-fns";

interface Props {
  users: User[];
  currentUserId: string;
}

export default function UsersView({ users: initialUsers, currentUserId }: Props) {
  const [userList, setUserList] = useState(initialUsers);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" as "admin" | "user", maxGrabsPerDay: 20 });
  const [saving, setSaving] = useState(false);

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
        body: JSON.stringify(newUser),
      });
      const data = await response.json() as { user?: User; error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Failed to create user");
        return;
      }
      setUserList((prev) => [...prev, data.user!]);
      setShowAdd(false);
      setNewUser({ username: "", password: "", role: "user", maxGrabsPerDay: 20 });
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
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          Add User
        </button>
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
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <span className="text-xs font-semibold text-primary uppercase">
                        {user.username.charAt(0)}
                      </span>
                    </div>
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
                      title={user.isActive ? "Disable" : "Enable"}
                    >
                      {user.isActive ? <X className="h-4 w-4" /> : <Check className="h-4 w-4 text-green-400" />}
                    </button>
                    <button
                      onClick={() => deleteUser(user)}
                      disabled={user.id === currentUserId}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-30"
                      title="Delete"
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
    </div>
  );
}
