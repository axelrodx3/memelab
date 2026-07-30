async function listPaths(admin, bucket, prefix) {
  const paths = [];
  let offset = 0;
  while (true) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" }
    });
    if (error) throw error;
    if (!data?.length) break;
    paths.push(...data.filter((entry) => entry.id).map((entry) => `${prefix}/${entry.name}`));
    if (data.length < 100) break;
    offset += data.length;
  }
  return paths;
}

export async function deleteMemberAccount(admin, userId) {
  for (const bucket of ["avatars", "community", "project-assets"]) {
    const paths = await listPaths(admin, bucket, userId);
    if (paths.length) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw error;
    }
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw error;
}
