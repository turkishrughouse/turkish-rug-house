#!/usr/bin/env bash
set -euo pipefail

cp -a /source/. /var/lib/postgresql/data/
chown -R postgres:postgres /var/lib/postgresql/data
chmod 700 /var/lib/postgresql/data

# Work only on the copied temp cluster. This guarantees the source volume remains untouched.
printf "CREATE ROLE postgres WITH LOGIN SUPERUSER;\n" \
  | su postgres -c "/usr/lib/postgresql/16/bin/postgres --single -D /var/lib/postgresql/data postgres" \
  >/dev/null 2>&1 || true

cp /var/lib/postgresql/data/pg_hba.conf /var/lib/postgresql/data/pg_hba.conf.bak
{
  printf "local all all trust\n"
  cat /var/lib/postgresql/data/pg_hba.conf.bak
} > /var/lib/postgresql/data/pg_hba.conf

su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data -o \"-k /tmp -c listen_addresses=''\" -w start"

echo "SOURCE_VOLUME|${SOURCE_VOLUME_NAME}"
echo "DATABASES"
psql -h /tmp -U postgres -At -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;"

while IFS= read -r db; do
  [[ -z "$db" ]] && continue
  echo "__DB__|$db"

  for table in Product Category DesignSettings User CustomerProfile Order; do
    has_table="$(psql -h /tmp -U postgres -d "$db" -At -c "SELECT CASE WHEN to_regclass('public.\"${table}\"') IS NULL THEN 'f' ELSE 't' END;")"
    if [[ "$has_table" == "t" ]]; then
      count="$(psql -h /tmp -U postgres -d "$db" -At -c "SELECT COUNT(*)::text FROM public.\"${table}\";")"
    else
      count=""
    fi
    echo "COUNT|$db|$table|$count"
  done

  has_product="$(psql -h /tmp -U postgres -d "$db" -At -c "SELECT CASE WHEN to_regclass('public.\"Product\"') IS NULL THEN 'f' ELSE 't' END;")"
  if [[ "$has_product" == "t" ]]; then
    echo "__PRODUCTS__|$db"
    psql -h /tmp -U postgres -d "$db" -At -F "|" -c "SELECT COALESCE(title, ''), COALESCE(slug, '') FROM public.\"Product\" ORDER BY 1,2 LIMIT 20;"
  fi
done < <(psql -h /tmp -U postgres -At -c "SELECT datname FROM pg_database WHERE datistemplate = false ORDER BY datname;")

su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /var/lib/postgresql/data -m fast stop"
