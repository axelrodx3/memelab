import assert from "node:assert/strict";
import test from "node:test";
import { deleteMemberAccount } from "../lib/account-deletion.mjs";

test("deletes only a temporary member's uploaded files before deleting auth", async () => {
  const temporaryUserId = "00000000-0000-4000-8000-000000000777";
  const removed = [];
  const deletedUsers = [];
  const files = {
    avatars: [{ id: "avatar-file", name: "avatar.webp" }],
    community: [{ id: "post-file", name: "post.png" }]
  };
  const admin = {
    storage: {
      from(bucket) {
        return {
          async list(prefix) {
            assert.equal(prefix, temporaryUserId);
            return { data: files[bucket], error: null };
          },
          async remove(paths) {
            removed.push([bucket, paths]);
            return { error: null };
          }
        };
      }
    },
    auth: {
      admin: {
        async deleteUser(userId) {
          deletedUsers.push(userId);
          return { error: null };
        }
      }
    }
  };

  await deleteMemberAccount(admin, temporaryUserId);

  assert.deepEqual(removed, [
    ["avatars", [`${temporaryUserId}/avatar.webp`]],
    ["community", [`${temporaryUserId}/post.png`]]
  ]);
  assert.deepEqual(deletedUsers, [temporaryUserId]);
});

test("does not delete auth when temporary storage cleanup fails", async () => {
  let authDeleted = false;
  const admin = {
    storage: {
      from(bucket) {
        return {
          async list() {
            return { data: bucket === "avatars" ? [{ id: "file", name: "avatar.png" }] : [], error: null };
          },
          async remove() {
            return { error: new Error("temporary storage failure") };
          }
        };
      }
    },
    auth: {
      admin: {
        async deleteUser() {
          authDeleted = true;
          return { error: null };
        }
      }
    }
  };

  await assert.rejects(
    () => deleteMemberAccount(admin, "00000000-0000-4000-8000-000000000888"),
    /temporary storage failure/
  );
  assert.equal(authDeleted, false);
});
