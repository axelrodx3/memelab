"use client";

import {
  Ban, Bell, Check, ChevronRight, CircleUserRound, Download, Eye, EyeOff,
  Clock3, ImagePlus, Info, KeyRound, Laptop, LogOut, RotateCcw, Save, ShieldCheck,
  Trash2, UploadCloud, UserRound, UserX
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import PresenceStatus from "../components/PresenceStatus";
import { createClient } from "../../lib/supabase/client";
import styles from "./AccountCenter.module.css";

const TABS = [
  ["profile", CircleUserRound, "Profile"],
  ["preferences", Eye, "Preferences"],
  ["notifications", Bell, "Notifications"],
  ["security", ShieldCheck, "Security"],
  ["data", Download, "Data & account"]
];
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 5 * 1024 * 1024;

function defaultAvatar(gender) {
  return gender === "female" ? "/avatars/default-female.png" : "/avatars/default-male.png";
}

function extensionFor(file) {
  return { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[file.type] || "jpg";
}

function usernameAvailableAt(value) {
  if (!value) return null;
  const date = new Date(value);
  date.setDate(date.getDate() + 30);
  return date;
}

function formatCountdown(milliseconds) {
  const minutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainingMinutes = minutes % 60;
  return [
    days ? `${days}d` : "",
    hours ? `${hours}h` : "",
    `${remainingMinutes}m`
  ].filter(Boolean).join(" ");
}

function FieldMessage({ value }) {
  return value ? <p className={styles.message} role="status">{value}</p> : null;
}

function ImageGuide({ label, children, placement = "below" }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className={`${styles.imageGuide} ${placement === "above" ? styles.imageGuideAbove : ""}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className={styles.imageGuideButton}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
      >
        <Info size={14} />
      </button>
      {open && <span className={styles.imageGuidePanel} role="tooltip">{children}</span>}
    </span>
  );
}

function Toggle({ checked, onChange, title, description }) {
  return (
    <label className={styles.toggle}>
      <span><strong>{title}</strong><small>{description}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <i aria-hidden="true" />
    </label>
  );
}

export default function AccountCenter({ profile: initialProfile, settings: initialSettings, initialBlocks = [] }) {
  const [tab, setTab] = useState("profile");
  const [profile, setProfile] = useState(initialProfile);
  const [settings, setSettings] = useState(initialSettings);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [blocks, setBlocks] = useState(initialBlocks);
  const [now, setNow] = useState(() => Date.now());
  const avatarInput = useRef(null);
  const bannerInput = useRef(null);
  const availableAt = useMemo(() => usernameAvailableAt(profile.username_changed_at), [profile.username_changed_at]);
  const usernameLocked = availableAt && availableAt.getTime() > now;

  useEffect(() => {
    if (!usernameLocked) return undefined;
    const interval = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(interval);
  }, [usernameLocked]);

  const run = async (name, callback) => {
    setBusy(name);
    setMessage("");
    try {
      await callback();
    } catch (error) {
      setMessage(error.message || "Something went wrong. Please try again.");
    } finally {
      setBusy("");
    }
  };

  const uploadImage = async (kind, file) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.has(file.type)) return setMessage("Use a PNG, JPG or WEBP image.");
    if (file.size > MAX_BYTES) return setMessage("Images must be 5MB or smaller.");
    await run(kind, async () => {
      const supabase = createClient();
      const path = `${profile.id}/${kind}-${crypto.randomUUID()}.${extensionFor(file)}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        contentType: file.type,
        cacheControl: "31536000"
      });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const column = kind === "avatar" ? "avatar_url" : "banner_url";
      const { error } = await supabase.from("profiles").update({ [column]: data.publicUrl }).eq("id", profile.id);
      if (error) {
        await supabase.storage.from("avatars").remove([path]);
        throw error;
      }
      setProfile((current) => ({ ...current, [column]: data.publicUrl }));
      setMessage(`${kind === "avatar" ? "Profile image" : "Banner"} updated.`);
    });
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") || "").trim();
    const displayName = String(form.get("displayName") || "").trim();
    const bio = String(form.get("bio") || "").trim();
    await run("profile", async () => {
      const supabase = createClient();
      if (username.toLowerCase() !== profile.username.toLowerCase()) {
        const { data: available, error: checkError } = await supabase.rpc("is_username_available", { candidate_username: username });
        if (checkError) throw checkError;
        if (!available) throw new Error("That username is taken or reserved. Try a different one.");
      }
      const { data, error } = await supabase
        .from("profiles")
        .update({ username, display_name: displayName, bio })
        .eq("id", profile.id)
        .select("username,display_name,bio,username_changed_at")
        .single();
      if (error) throw error;
      setProfile((current) => ({ ...current, ...data }));
      setMessage("Profile saved.");
    });
  };

  const saveSettings = async (section) => run(section, async () => {
    const supabase = createClient();
    const profileValues = {
      mature_content_enabled: profile.mature_content_enabled,
      profile_visibility: profile.profile_visibility,
      show_activity: profile.show_activity
    };
    const { error: profileError } = await supabase.from("profiles").update(profileValues).eq("id", profile.id);
    if (profileError) throw profileError;
    const { error: settingsError } = await supabase.from("account_settings").update(settings).eq("user_id", profile.id);
    if (settingsError) throw settingsError;
    window.dispatchEvent(new CustomEvent("memelab:presence-settings", { detail: { enabled: settings.show_online_status } }));
    setMessage("Settings saved.");
  });

  const blockUser = async (event) => {
    event.preventDefault();
    const username = String(new FormData(event.currentTarget).get("blockedUsername") || "").trim();
    await run("block", async () => {
      const supabase = createClient();
      const { data: blocked, error: profileError } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url")
        .ilike("username", username)
        .eq("account_status", "active")
        .maybeSingle();
      if (profileError) throw profileError;
      if (!blocked) throw new Error("No active MemeLab member uses that username.");
      if (blocked.id === profile.id) throw new Error("You cannot block your own account.");
      const { error } = await supabase.from("user_blocks").insert({ blocker_id: profile.id, blocked_id: blocked.id });
      if (error?.code === "23505") throw new Error("That member is already blocked.");
      if (error) throw error;
      setBlocks((current) => [{ blocked_id: blocked.id, created_at: new Date().toISOString(), blocked }, ...current]);
      event.currentTarget.reset();
      setMessage(`@${blocked.username} is now blocked.`);
    });
  };

  const unblockUser = (blockedId) => run("unblock", async () => {
    const { error } = await createClient()
      .from("user_blocks")
      .delete()
      .eq("blocker_id", profile.id)
      .eq("blocked_id", blockedId);
    if (error) throw error;
    setBlocks((current) => current.filter((item) => item.blocked_id !== blockedId));
    setMessage("Member unblocked.");
  });

  const selectGender = async (gender) => run("gender", async () => {
    const supabase = createClient();
    const avatar = !profile.avatar_url || profile.avatar_url.startsWith("/avatars/default-")
      ? defaultAvatar(gender)
      : profile.avatar_url;
    const [{ error: settingsError }, { error: profileError }] = await Promise.all([
      supabase.from("account_settings").update({ gender }).eq("user_id", profile.id),
      supabase.from("profiles").update({ avatar_url: avatar }).eq("id", profile.id)
    ]);
    if (settingsError || profileError) throw settingsError || profileError;
    setSettings((current) => ({ ...current, gender }));
    setProfile((current) => ({ ...current, avatar_url: avatar }));
    setMessage("Default profile selection saved.");
  });

  const resetAvatar = async () => {
    if (!settings.gender) return setMessage("Choose Female or Male before restoring a default image.");
    await run("avatar", async () => {
      const avatar_url = defaultAvatar(settings.gender);
      const supabase = createClient();
      const { error } = await supabase.from("profiles").update({ avatar_url }).eq("id", profile.id);
      if (error) throw error;
      setProfile((current) => ({ ...current, avatar_url }));
      setMessage("Default profile image restored.");
    });
  };

  const changeEmail = async (event) => {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") || "").trim();
    await run("email", async () => {
      const { error } = await createClient().auth.updateUser({ email });
      if (error) throw error;
      setMessage("Check your inboxes to approve the email change.");
      event.currentTarget.reset();
    });
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const password = String(form.get("password") || "");
    const confirmPassword = String(form.get("confirmPassword") || "");
    if (password !== confirmPassword) return setMessage("New passwords do not match.");
    await run("password", async () => {
      const { error } = await createClient().auth.updateUser({ password, currentPassword });
      if (error) throw error;
      setMessage("Password changed.");
      event.currentTarget.reset();
    });
  };

  const sendReset = () => run("reset", async () => {
    const { error } = await createClient().auth.resetPasswordForEmail(profile.email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/update-password`
    });
    if (error) throw error;
    setMessage("A secure password-reset link was sent.");
  });

  const signOut = (scope) => run(`signout-${scope}`, async () => {
    const { error } = await createClient().auth.signOut({ scope });
    if (error) throw error;
    if (scope !== "others") window.location.assign("/");
    else setMessage("Every other session has been signed out.");
  });

  const deactivate = () => run("deactivate", async () => {
    const supabase = createClient();
    const nextStatus = profile.account_status === "active" ? "deactivated" : "active";
    if (nextStatus === "deactivated") {
      const { error: settingsError } = await supabase
        .from("account_settings")
        .update({ visibility_before_deactivation: profile.profile_visibility })
        .eq("user_id", profile.id);
      if (settingsError) throw settingsError;
      setSettings((current) => ({ ...current, visibility_before_deactivation: profile.profile_visibility }));
    }
    const restoredVisibility = settings.visibility_before_deactivation || "public";
    const { error } = await supabase.from("profiles").update({ account_status: nextStatus }).eq("id", profile.id);
    if (error) throw error;
    if (nextStatus === "active") {
      const { error: visibilityError } = await supabase
        .from("profiles")
        .update({ profile_visibility: restoredVisibility })
        .eq("id", profile.id);
      if (visibilityError) throw visibilityError;
    }
    setProfile((current) => ({
      ...current,
      account_status: nextStatus,
      profile_visibility: nextStatus === "deactivated" ? "private" : restoredVisibility
    }));
    setMessage(nextStatus === "active" ? "Your account is active again." : "Your account is deactivated and hidden. You can reactivate it here anytime.");
  });

  const deleteAccount = async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (String(form.get("confirmation")) !== "DELETE") return setMessage("Type DELETE exactly to continue.");
    await run("delete", async () => {
      const response = await fetch("/api/account/delete", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: String(form.get("password") || "") })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Account deletion failed.");
      window.location.assign("/");
    });
  };

  const avatarUrl = profile.avatar_url || (settings.gender ? defaultAvatar(settings.gender) : "/avatars/default-female.png");

  return (
    <section className={`${styles.shell} shell`}>
      <header className={`${styles.hero} glass`}>
        <div className={styles.banner}>
          {profile.banner_url && <Image src={profile.banner_url} alt="" fill priority sizes="1200px" />}
          <div className={styles.bannerActions}>
            <button type="button" onClick={() => bannerInput.current?.click()}><ImagePlus size={15} /> Change banner</button>
            <ImageGuide label="Banner image recommendations" placement="above">Best results: 1600 × 500 px (3.2:1). Keep important details near the middle. PNG, JPG or WEBP · 5MB max.</ImageGuide>
          </div>
          <input ref={bannerInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage("banner", event.target.files?.[0])} />
        </div>
        <div className={styles.identity}>
          <div className={styles.avatar}><Image src={avatarUrl} alt="" fill priority sizes="112px" /></div>
          <div>
            <h1>{profile.display_name || profile.username}</h1>
            <p>@{profile.username} · {profile.karma} karma</p>
          </div>
          {profile.account_status === "active"
            ? <PresenceStatus userId={profile.id} />
            : <div className={styles.inactive}><i /> Deactivated</div>}
        </div>
      </header>

      {profile.account_status === "deactivated" && (
        <div className={`${styles.reactivationNotice} glass`}>
          <div className={styles.reactivationIcon}><RotateCcw size={19} /></div>
          <div>
            <strong>Your account is paused</strong>
            <p>Your profile and community activity are hidden. Reactivate to restore your previous privacy setting and continue where you left off.</p>
          </div>
          <button className={styles.primaryButton} onClick={deactivate} disabled={busy === "deactivate"}>
            <RotateCcw size={14} /> {busy === "deactivate" ? "Restoring…" : "Reactivate MemeLab"}
          </button>
        </div>
      )}

      {!settings.gender && (
        <div className={`${styles.setupNotice} glass`}>
          <UserRound size={20} />
          <div><strong>Finish your profile setup</strong><p>Choose a default profile below. This setting stays private.</p></div>
          <button onClick={() => setTab("profile")}>Choose now <ChevronRight size={15} /></button>
        </div>
      )}

      <div className={styles.layout}>
        <nav className={`${styles.nav} glass`} aria-label="Account sections">
          {TABS.map(([value, Icon, label]) => (
            <button key={value} className={tab === value ? styles.selected : ""} onClick={() => { setTab(value); setMessage(""); }}>
              <Icon size={17} /><span>{label}</span><ChevronRight size={14} />
            </button>
          ))}
        </nav>

        <div className={styles.content}>
          <FieldMessage value={message} />

          {tab === "profile" && (
            <>
              <section className={`${styles.panel} glass`}>
                <div className={styles.panelHeading}><div><span>IDENTITY</span><h2>Profile image</h2><div className={styles.hintLine}><p>Use your default silhouette or upload something personal.</p><ImageGuide label="Profile image recommendations">Best results: a square 800 × 800 px image (400 × 400 px minimum). PNG, JPG or WEBP · 5MB max.</ImageGuide></div></div></div>
                <div className={styles.avatarRow}>
                  <div className={styles.largeAvatar}><Image src={avatarUrl} alt="Current profile" fill sizes="128px" /></div>
                  <div className={styles.avatarActions}>
                    <button className={styles.primaryButton} onClick={() => avatarInput.current?.click()} disabled={busy === "avatar"}><UploadCloud size={15} /> Upload image</button>
                    <button className={styles.ghostButton} onClick={resetAvatar}>Restore default</button>
                    <small>PNG, JPG or WEBP · 5MB maximum</small>
                    <input ref={avatarInput} hidden type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadImage("avatar", event.target.files?.[0])} />
                  </div>
                </div>
                <div className={styles.genderGrid}>
                  {[
                    ["female", "Female", "/avatars/default-female.png"],
                    ["male", "Male", "/avatars/default-male.png"]
                  ].map(([value, label, image]) => (
                    <button key={value} type="button" className={settings.gender === value ? styles.genderSelected : ""} onClick={() => selectGender(value)}>
                      <Image src={image} alt="" width={54} height={54} /><span><strong>{label}</strong><small>Default profile image</small></span>{settings.gender === value && <Check size={16} />}
                    </button>
                  ))}
                </div>
              </section>
              <form className={`${styles.panel} glass`} onSubmit={saveProfile}>
                <div className={styles.panelHeading}><div><span>PUBLIC PROFILE</span><h2>How people see you</h2><p>Your username is unique across MemeLab.</p></div></div>
                <div className={styles.fields}>
                  <label>Username<input name="username" defaultValue={profile.username} disabled={usernameLocked} pattern="[A-Za-z0-9_]+" minLength={3} maxLength={20} required /></label>
                  <label>Display name<input name="displayName" defaultValue={profile.display_name || ""} maxLength={50} required /></label>
                  <label className={styles.wide}>Bio<textarea name="bio" defaultValue={profile.bio || ""} maxLength={240} rows={4} placeholder="Tell the community who you are." /></label>
                </div>
                {usernameLocked ? (
                  <div className={styles.cooldown}>
                    <Clock3 size={16} />
                    <div><strong>Username locked for {formatCountdown(availableAt.getTime() - now)}</strong><span>You can change it again on {availableAt.toLocaleDateString()}.</span></div>
                  </div>
                ) : (
                  <p className={styles.help}>After changing your username, the next change unlocks in 30 days.</p>
                )}
                <button className={styles.primaryButton} disabled={busy === "profile"}><Save size={15} /> {busy === "profile" ? "Saving…" : "Save profile"}</button>
              </form>
            </>
          )}

          {tab === "preferences" && (
            <section className={`${styles.panel} glass`}>
              <div className={styles.panelHeading}><div><span>EXPERIENCE</span><h2>Privacy & content</h2><p>Control what appears and what others can see.</p></div></div>
              <div className={styles.toggleList}>
                <Toggle checked={profile.mature_content_enabled} onChange={(value) => setProfile((current) => ({ ...current, mature_content_enabled: value }))} title="Reveal mature content automatically" description="Otherwise mature posts stay behind a click-to-view warning." />
                <Toggle checked={profile.profile_visibility === "public"} onChange={(value) => setProfile((current) => ({ ...current, profile_visibility: value ? "public" : "private" }))} title="Public profile" description="Allow other members to open your profile and see your public posts." />
                <Toggle checked={profile.show_activity} onChange={(value) => setProfile((current) => ({ ...current, show_activity: value }))} title="Show profile activity" description="Display your public posts, comments and saved templates on your profile." />
                <Toggle checked={settings.show_online_status} onChange={(value) => setSettings((current) => ({ ...current, show_online_status: value }))} title="Show when I’m online" description="Let other members see your live Online status. Turn this off to always appear Offline." />
              </div>
              <div className={styles.selectSetting}>
                <div><strong>Who can message me</strong><small>Interactions includes accepted friends or creators you’ve exchanged comments or replies with.</small></div>
                <select value={settings.message_permission} onChange={(event) => setSettings((current) => ({ ...current, message_permission: event.target.value }))}>
                  <option value="everyone">Everyone</option>
                  <option value="interactions">People I’ve interacted with</option>
                  <option value="nobody">Nobody</option>
                </select>
              </div>
              <button className={styles.primaryButton} onClick={() => saveSettings("preferences")} disabled={busy === "preferences"}><Save size={15} /> Save preferences</button>
              <div className={styles.blockSection}>
                <div className={styles.panelHeading}><div><span>SAFETY</span><h2>Blocked members</h2><p>Blocked members cannot message you or send you friend requests. Existing friend connections are removed.</p></div><Ban size={22} /></div>
                <form className={styles.blockForm} onSubmit={blockUser}>
                  <input name="blockedUsername" required pattern="[A-Za-z0-9_]+" placeholder="Enter a username" />
                  <button className={styles.ghostButton} disabled={busy === "block"}><UserX size={14} /> Block</button>
                </form>
                <div className={styles.blockList}>
                  {blocks.map((item) => <div key={item.blocked_id}><span><strong>{item.blocked?.display_name || item.blocked?.username}</strong><small>@{item.blocked?.username}</small></span><button type="button" onClick={() => unblockUser(item.blocked_id)} disabled={busy === "unblock"}>Unblock</button></div>)}
                  {!blocks.length && <p>You haven’t blocked anyone.</p>}
                </div>
              </div>
            </section>
          )}

          {tab === "notifications" && (
            <section className={`${styles.panel} glass`}>
              <div className={styles.panelHeading}><div><span>NOTIFICATIONS</span><h2>Stay in the loop</h2><p>Set the moments you want MemeLab to notify you about.</p></div></div>
              <div className={styles.deliveryNotice}>
                <Bell size={17} />
                <div><strong>In-app alerts are live</strong><p>These choices control your MemeLab notification center. Email delivery remains optional and will arrive later.</p></div>
                <span>LIVE</span>
              </div>
              <div className={styles.toggleList}>
                <Toggle checked={settings.notification_email} onChange={(value) => setSettings((current) => ({ ...current, notification_email: value }))} title="Email notifications" description="Master switch for optional MemeLab emails." />
                <Toggle checked={settings.notification_replies} onChange={(value) => setSettings((current) => ({ ...current, notification_replies: value }))} title="Replies and comments" description="Hear when someone joins your conversation." />
                <Toggle checked={settings.notification_votes} onChange={(value) => setSettings((current) => ({ ...current, notification_votes: value }))} title="Vote milestones" description="Celebrate meaningful traction on your posts." />
                <Toggle checked={settings.notification_social !== false} onChange={(value) => setSettings((current) => ({ ...current, notification_social: value }))} title="Friend activity" description="See friend requests and accepted connections in your notification center." />
                <Toggle checked={settings.notification_messages !== false} onChange={(value) => setSettings((current) => ({ ...current, notification_messages: value }))} title="Private messages" description="See a notification when someone sends you a direct message." />
              </div>
              <button className={styles.primaryButton} onClick={() => saveSettings("notifications")} disabled={busy === "notifications"}><Save size={15} /> Save notifications</button>
            </section>
          )}

          {tab === "security" && (
            <>
              <form className={`${styles.panel} glass`} onSubmit={changeEmail}>
                <div className={styles.panelHeading}><div><span>EMAIL</span><h2>Change email address</h2><p>Current email: {profile.email}</p></div></div>
                <div className={styles.inlineForm}><input name="email" type="email" required placeholder="new@email.com" /><button className={styles.primaryButton} disabled={busy === "email"}>Verify change</button></div>
              </form>
              <form className={`${styles.panel} glass`} onSubmit={changePassword}>
                <div className={styles.panelHeading}><div><span>PASSWORD</span><h2>Update your password</h2><p>Use at least 8 characters and keep it unique.</p></div></div>
                <div className={styles.fields}>
                  <label className={styles.wide}>Current password<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                  <label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label>
                  <label>Confirm new password<input name="confirmPassword" type="password" minLength={8} autoComplete="new-password" required /></label>
                </div>
                <div className={styles.buttonRow}><button className={styles.primaryButton} disabled={busy === "password"}><KeyRound size={15} /> Change password</button><button type="button" className={styles.ghostButton} onClick={sendReset}>Email reset link</button></div>
              </form>
              <section className={`${styles.panel} glass`}>
                <div className={styles.panelHeading}><div><span>SESSIONS</span><h2>Signed-in devices</h2><p>Secure your account by ending sessions you no longer use.</p></div><Laptop size={24} /></div>
                <div className={styles.sessionCard}><div><strong>This device</strong><small>Current browser session</small></div><span>Active now</span></div>
                <div className={styles.buttonRow}><button className={styles.ghostButton} onClick={() => signOut("others")}><LogOut size={14} /> Sign out other devices</button><button className={styles.ghostButton} onClick={() => signOut("global")}><LogOut size={14} /> Sign out everywhere</button></div>
              </section>
            </>
          )}

          {tab === "data" && (
            <>
              <section className={`${styles.panel} glass`}>
                <div className={styles.panelHeading}><div><span>YOUR DATA</span><h2>Download your MemeLab data</h2><p>Get a JSON archive of your profile, posts, comments, votes and settings.</p></div><Download size={25} /></div>
                <a className={styles.primaryButton} href="/api/account/export" download><Download size={15} /> Download archive</a>
              </section>
              <section className={`${styles.panel} ${styles.dangerPanel} glass`}>
                <div className={styles.panelHeading}><div><span>DANGER ZONE</span><h2>Account controls</h2><p>Deactivate temporarily or permanently remove your account.</p></div></div>
                <div className={styles.dangerAction}>
                  <div><strong>{profile.account_status === "active" ? "Deactivate account" : "Reactivate account"}</strong><small>{profile.account_status === "active" ? "Hide your profile and stop community activity until you return." : "Restore your profile and community access."}</small></div>
                  <button className={styles.ghostButton} onClick={deactivate}>{profile.account_status === "active" ? "Deactivate" : "Reactivate"}</button>
                </div>
                <div className={styles.dangerAction}>
                  <div><strong>Delete account permanently</strong><small>Erase your account and uploaded media. This cannot be undone.</small></div>
                  <button className={styles.deleteButton} onClick={() => setDeleteOpen(true)}><Trash2 size={14} /> Delete</button>
                </div>
                {deleteOpen && (
                  <form className={styles.deleteForm} onSubmit={deleteAccount}>
                    <p>Enter your password and type <strong>DELETE</strong> to confirm.</p>
                    <input name="password" type="password" required placeholder="Current password" />
                    <input name="confirmation" required placeholder="Type DELETE" />
                    <div className={styles.buttonRow}><button type="button" className={styles.ghostButton} onClick={() => setDeleteOpen(false)}>Cancel</button><button className={styles.deleteButton} disabled={busy === "delete"}>Delete forever</button></div>
                  </form>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
