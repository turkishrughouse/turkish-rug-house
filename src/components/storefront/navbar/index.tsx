import { getSiteSettings } from "@/lib/site-settings"
import { getPublicCategoryTreeMenu, getPublicMenu, type PublicMenuNode } from "@/lib/storefront/public-menu"
import { getShippingReturnsPage, getShippingReturnsPageUrl } from "@/lib/storefront/shipping-returns-page"
import { BackToTopButton } from "@/components/storefront/back-to-top-button"
import { TopBar } from "./top-bar"
import { MainHeader } from "./main-header"

function isInformationLink(url: string) {
    if (!url || url === "#") return false
    if (/^https?:\/\//i.test(url)) return false
    return !(
        url.startsWith("/product/") ||
        url.startsWith("/category/") ||
        url.startsWith("/basket") ||
        url.startsWith("/checkout") ||
        url.startsWith("/account") ||
        url.startsWith("/compare") ||
        url.startsWith("/wishlist")
    )
}

function filterInformationMenu(nodes: PublicMenuNode[]): PublicMenuNode[] {
    return nodes
        .map((node) => {
            const children = filterInformationMenu(node.children || [])
            const hasValidUrl = isInformationLink(node.url)
            if (!hasValidUrl && children.length === 0) return null
            return {
                ...node,
                url: hasValidUrl ? node.url : children[0]?.url || "#",
                children,
            }
        })
        .filter((node): node is PublicMenuNode => Boolean(node))
}

function hasMenuUrl(nodes: PublicMenuNode[], targetUrl: string): boolean {
    return nodes.some((node) => node.url === targetUrl || hasMenuUrl(node.children || [], targetUrl))
}

export async function Header() {
    const [settings, topNavMenu, primaryMenu, headerInfoMenu, footerInfoMenu, categoryTreeMenu, shippingReturnsPage] = await Promise.all([
        getSiteSettings(),
        getPublicMenu("TOP_NAV"),
        getPublicMenu("PRIMARY_HEADER"),
        getPublicMenu("HEADER_INFORMATION"),
        getPublicMenu("INFORMATION_FOOTER"),
        getPublicCategoryTreeMenu(),
        getShippingReturnsPage(),
    ])

    const mobileCategoriesMenu = primaryMenu.length > 0 ? primaryMenu : categoryTreeMenu
    const informationMenu = filterInformationMenu(headerInfoMenu.length > 0 ? headerInfoMenu : footerInfoMenu)
    const shippingReturnsUrl = shippingReturnsPage ? getShippingReturnsPageUrl(shippingReturnsPage) : null
    const resolvedInformationMenu =
        shippingReturnsPage && shippingReturnsUrl && !hasMenuUrl(informationMenu, shippingReturnsUrl)
            ? [
                ...informationMenu,
                {
                    id: shippingReturnsPage.id,
                    label: shippingReturnsPage.title || "Shipping & Returns",
                    url: shippingReturnsUrl,
                    children: [],
                },
            ]
            : informationMenu
    const mobilePagesMenu = resolvedInformationMenu

    return (
        <header className="z-[310] flex flex-col bg-white">
            <TopBar
                items={topNavMenu.map((item) => ({ id: item.id, label: item.label, url: item.url }))}
                language={settings.defaultLanguage}
                currency={settings.defaultCurrency}
            />
            <div className="sticky top-0 z-[310] bg-white">
                <MainHeader
                    initialBrandPrimary={settings.brandPrimary}
                    initialBrandSecondary={settings.brandSecondary}
                    initialMaintenanceMode={settings.maintenanceMode}
                    initialCurrencySettings={{
                        defaultCurrency: settings.defaultCurrency,
                        currencyPosition: settings.currencyPosition,
                        thousandSeparator: settings.thousandSeparator,
                        decimalSeparator: settings.decimalSeparator,
                        numberOfDecimals: settings.numberOfDecimals,
                    }}
                    initialSendPasswordSetupLink={settings.sendPasswordSetupLink}
                    initialMobileCategoriesMenu={mobileCategoriesMenu}
                    initialMobilePagesMenu={mobilePagesMenu}
                    initialPrimaryMenu={primaryMenu}
                    initialInformationMenu={resolvedInformationMenu}
                />
            </div>
            <BackToTopButton />
        </header>
    )
}
