export const DASHBOARD_DATA = {
    kpi: [
        {
            label: "Total Revenue",
            value: "$82,650",
            trend: "+12.5%",
            isPositive: true,
            period: "Last 30 days"
        },
        {
            label: "Total Orders",
            value: "1,645",
            trend: "+8.2%",
            isPositive: true,
            period: "Last 30 days"
        },
        {
            label: "Total Customers",
            value: "1,462",
            trend: "-2.4%",
            isPositive: false,
            period: "Last 30 days"
        },
        {
            label: "Pending Delivery",
            value: "117",
            trend: "+0.4%",
            isPositive: true,
            period: "Last 30 days"
        }
    ],
    salesChart: [
        { name: 'Mon', income: 4000, expense: 2400 },
        { name: 'Tue', income: 3000, expense: 1398 },
        { name: 'Wed', income: 2000, expense: 9800 },
        { name: 'Thu', income: 2780, expense: 3908 },
        { name: 'Fri', income: 1890, expense: 4800 },
        { name: 'Sat', income: 2390, expense: 3800 },
        { name: 'Sun', income: 3490, expense: 4300 },
    ],
    salesTarget: [
        { name: 'Achieved', value: 75, fill: '#171717' },
        { name: 'Remaining', value: 25, fill: '#e5e5e5' },
    ],
    topProducts: [
        {
            id: "1",
            name: "Oushak Rug",
            sales: "752 pcs",
            image: "https://placehold.co/150x150/f4f4f0/171717?text=Oushak"
        },
        {
            id: "2",
            name: "Tabriz Silk",
            sales: "432 pcs",
            image: "https://placehold.co/150x150/e5e5e5/171717?text=Tabriz"
        },
        {
            id: "3",
            name: "Anatolian Kilim",
            sales: "321 pcs",
            image: "https://placehold.co/150x150/d4d4d4/171717?text=Kilim"
        },
        {
            id: "4",
            name: "Modern Runner",
            sales: "210 pcs",
            image: "https://placehold.co/150x150/f4f4f0/171717?text=Runner"
        }
    ],
    offers: [
        { label: "40% Discount Offer", value: 80, color: "bg-blue-500" },
        { label: "100 Taka Coupon", value: 65, color: "bg-orange-500" },
        { label: "Stock Out Sell", value: 30, color: "bg-red-500" }
    ]
}
