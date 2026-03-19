import { randomUUID } from "node:crypto"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/db"
import { ensureTableColumns } from "@/lib/db-compat"

export type SavedCustomerAddress = {
  id: string
  label: string
  fullName: string
  phoneNumber: string
  country: string
  countryCode: string
  state: string
  city: string
  addressLine1: string
  addressLine2: string
  postalCode: string
  createdAt: string
  updatedAt: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

export type CustomerAddressInput = {
  id?: string
  label?: string
  fullName?: string
  phoneNumber?: string
  country?: string
  countryCode?: string
  state?: string
  city?: string
  addressLine1?: string
  addressLine2?: string
  postalCode?: string
}

type AddressBookRecord = {
  addresses: SavedCustomerAddress[]
  defaultShippingAddressId: string | null
  defaultBillingAddressId: string | null
}

function trim(value: string | null | undefined) {
  return (value || "").trim()
}

function addressKey(input: CustomerAddressInput) {
  return [
    trim(input.fullName).toLowerCase(),
    trim(input.phoneNumber).toLowerCase(),
    trim(input.country).toLowerCase(),
    trim(input.countryCode).toLowerCase(),
    trim(input.state).toLowerCase(),
    trim(input.city).toLowerCase(),
    trim(input.addressLine1).toLowerCase(),
    trim(input.addressLine2).toLowerCase(),
    trim(input.postalCode).toLowerCase(),
  ].join("|")
}

function normalizeAddress(input: CustomerAddressInput, existing?: SavedCustomerAddress): SavedCustomerAddress {
  const now = new Date().toISOString()
  return {
    id: trim(input.id) || existing?.id || randomUUID(),
    label: trim(input.label) || existing?.label || "Home",
    fullName: trim(input.fullName) || existing?.fullName || "",
    phoneNumber: trim(input.phoneNumber) || existing?.phoneNumber || "",
    country: trim(input.country) || existing?.country || "",
    countryCode: trim(input.countryCode) || existing?.countryCode || "",
    state: trim(input.state) || existing?.state || "",
    city: trim(input.city) || existing?.city || "",
    addressLine1: trim(input.addressLine1) || existing?.addressLine1 || "",
    addressLine2: trim(input.addressLine2) || existing?.addressLine2 || "",
    postalCode: trim(input.postalCode) || existing?.postalCode || "",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    isDefaultShipping: existing?.isDefaultShipping || false,
    isDefaultBilling: existing?.isDefaultBilling || false,
  }
}

function parseAddressBook(raw: string | null | undefined) {
  if (!raw) return [] as SavedCustomerAddress[]
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeAddress((item || {}) as CustomerAddressInput, item as SavedCustomerAddress))
      .filter((item) => item.addressLine1 || item.city || item.country)
  } catch {
    return []
  }
}

async function ensureCustomerAddressColumns() {
  await ensureTableColumns("CustomerProfile", [
    { name: "savedAddresses", postgresType: "TEXT", sqliteType: "TEXT" },
    { name: "defaultShippingAddressId", postgresType: "TEXT", sqliteType: "TEXT" },
    { name: "defaultBillingAddressId", postgresType: "TEXT", sqliteType: "TEXT" },
  ])
}

async function readRawAddressColumns(userId: string) {
  await ensureCustomerAddressColumns()
  const rows = await prisma.$queryRaw<Array<{
    savedAddresses: string | null
    defaultShippingAddressId: string | null
    defaultBillingAddressId: string | null
  }>>(Prisma.sql`
    SELECT "savedAddresses", "defaultShippingAddressId", "defaultBillingAddressId"
    FROM "CustomerProfile"
    WHERE "userId" = ${userId}
    LIMIT 1
  `)
  return rows[0] || {
    savedAddresses: null,
    defaultShippingAddressId: null,
    defaultBillingAddressId: null,
  }
}

async function writeRawAddressColumns(userId: string, data: AddressBookRecord) {
  await ensureCustomerAddressColumns()
  await prisma.customerProfile.upsert({
    where: { userId },
    create: { userId },
    update: {},
  })

  await prisma.$executeRaw(Prisma.sql`
    UPDATE "CustomerProfile"
    SET
      "savedAddresses" = ${JSON.stringify(data.addresses)},
      "defaultShippingAddressId" = ${data.defaultShippingAddressId},
      "defaultBillingAddressId" = ${data.defaultBillingAddressId}
    WHERE "userId" = ${userId}
  `)
}

async function syncLegacyProfileAddress(userId: string, address: SavedCustomerAddress | null) {
  const phoneValue = address?.phoneNumber || null
  const fullName = trim(address?.fullName)
  await prisma.$transaction(async (tx) => {
    await tx.customerProfile.upsert({
      where: { userId },
      create: {
        userId,
        addressLine1: address?.addressLine1 || null,
        addressLine2: address?.addressLine2 || null,
        city: address?.city || null,
        state: address?.state || null,
        postalCode: address?.postalCode || null,
        country: address?.country || null,
      },
      update: {
        addressLine1: address?.addressLine1 || null,
        addressLine2: address?.addressLine2 || null,
        city: address?.city || null,
        state: address?.state || null,
        postalCode: address?.postalCode || null,
        country: address?.country || null,
      },
    })

    await tx.user.update({
      where: { id: userId },
      data: {
        ...(phoneValue ? { phone: phoneValue } : {}),
        ...(fullName ? { name: fullName } : {}),
      },
    }).catch(() => null)
  })
}

function applyDefaults(addresses: SavedCustomerAddress[], defaultShippingAddressId: string | null, defaultBillingAddressId: string | null) {
  return addresses.map((address) => ({
    ...address,
    isDefaultShipping: Boolean(defaultShippingAddressId) && address.id === defaultShippingAddressId,
    isDefaultBilling: Boolean(defaultBillingAddressId) && address.id === defaultBillingAddressId,
  }))
}

export async function getCustomerAddressBook(userId: string) {
  await ensureCustomerAddressColumns()
  const [profile, user, raw] = await Promise.all([
    prisma.customerProfile.findUnique({
      where: { userId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        country: true,
      },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, phone: true },
    }),
    readRawAddressColumns(userId),
  ])

  let addresses = parseAddressBook(raw.savedAddresses)
  let defaultShippingAddressId = raw.defaultShippingAddressId
  let defaultBillingAddressId = raw.defaultBillingAddressId

  if (addresses.length === 0 && profile?.addressLine1) {
    const seeded = normalizeAddress({
      label: "Primary",
      fullName: user?.name || "",
      phoneNumber: user?.phone || "",
      country: profile.country || "",
      state: profile.state || "",
      city: profile.city || "",
      addressLine1: profile.addressLine1 || "",
      addressLine2: profile.addressLine2 || "",
      postalCode: profile.postalCode || "",
    })
    addresses = [seeded]
    defaultShippingAddressId = seeded.id
    defaultBillingAddressId = seeded.id
    await writeRawAddressColumns(userId, {
      addresses,
      defaultShippingAddressId,
      defaultBillingAddressId,
    })
  }

  if (!defaultShippingAddressId && addresses[0]) defaultShippingAddressId = addresses[0].id
  if (!defaultBillingAddressId && addresses[0]) defaultBillingAddressId = addresses[0].id

  return {
    addresses: applyDefaults(addresses, defaultShippingAddressId, defaultBillingAddressId),
    defaultShippingAddressId,
    defaultBillingAddressId,
  }
}

export async function upsertCustomerAddress(userId: string, input: CustomerAddressInput, options?: {
  makeDefaultShipping?: boolean
  makeDefaultBilling?: boolean
}) {
  const current = await getCustomerAddressBook(userId)
  const existing = current.addresses.find((address) => address.id === input.id)
  const nextAddress = normalizeAddress(input, existing)
  const nextKey = addressKey(nextAddress)
  const duplicate = current.addresses.find((address) => address.id !== nextAddress.id && addressKey(address) === nextKey)
  const targetId = duplicate?.id || nextAddress.id

  const merged = current.addresses
    .filter((address) => address.id !== nextAddress.id && address.id !== duplicate?.id)
    .concat(duplicate ? [{ ...duplicate, ...nextAddress, id: duplicate.id, createdAt: duplicate.createdAt, updatedAt: new Date().toISOString() }] : [nextAddress])

  const defaultShippingAddressId =
    options?.makeDefaultShipping
      ? targetId
      : current.defaultShippingAddressId || targetId
  const defaultBillingAddressId =
    options?.makeDefaultBilling
      ? targetId
      : current.defaultBillingAddressId || targetId

  const saved = applyDefaults(merged, defaultShippingAddressId, defaultBillingAddressId)
  await writeRawAddressColumns(userId, {
    addresses: saved,
    defaultShippingAddressId,
    defaultBillingAddressId,
  })
  await syncLegacyProfileAddress(userId, saved.find((address) => address.id === defaultShippingAddressId) || saved[0] || null)
  return {
    addresses: saved,
    defaultShippingAddressId,
    defaultBillingAddressId,
  }
}

export async function deleteCustomerAddress(userId: string, addressId: string) {
  const current = await getCustomerAddressBook(userId)
  const remaining = current.addresses.filter((address) => address.id !== addressId)
  const nextDefaultShippingAddressId =
    current.defaultShippingAddressId === addressId ? (remaining[0]?.id || null) : current.defaultShippingAddressId
  const nextDefaultBillingAddressId =
    current.defaultBillingAddressId === addressId ? (remaining[0]?.id || null) : current.defaultBillingAddressId

  const saved = applyDefaults(remaining, nextDefaultShippingAddressId, nextDefaultBillingAddressId)
  await writeRawAddressColumns(userId, {
    addresses: saved,
    defaultShippingAddressId: nextDefaultShippingAddressId,
    defaultBillingAddressId: nextDefaultBillingAddressId,
  })
  await syncLegacyProfileAddress(userId, saved.find((address) => address.id === nextDefaultShippingAddressId) || saved[0] || null)
  return {
    addresses: saved,
    defaultShippingAddressId: nextDefaultShippingAddressId,
    defaultBillingAddressId: nextDefaultBillingAddressId,
  }
}

export async function setDefaultCustomerAddress(userId: string, addressId: string, kind: "shipping" | "billing") {
  const current = await getCustomerAddressBook(userId)
  if (!current.addresses.some((address) => address.id === addressId)) {
    throw new Error("Address not found")
  }
  const nextDefaultShippingAddressId = kind === "shipping" ? addressId : current.defaultShippingAddressId
  const nextDefaultBillingAddressId = kind === "billing" ? addressId : current.defaultBillingAddressId
  const saved = applyDefaults(current.addresses, nextDefaultShippingAddressId, nextDefaultBillingAddressId)
  await writeRawAddressColumns(userId, {
    addresses: saved,
    defaultShippingAddressId: nextDefaultShippingAddressId,
    defaultBillingAddressId: nextDefaultBillingAddressId,
  })
  if (kind === "shipping") {
    await syncLegacyProfileAddress(userId, saved.find((address) => address.id === addressId) || null)
  }
  return {
    addresses: saved,
    defaultShippingAddressId: nextDefaultShippingAddressId,
    defaultBillingAddressId: nextDefaultBillingAddressId,
  }
}
