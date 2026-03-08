
import { View, Text, ScrollView, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useEffect, useState, useRef } from "react";
import CategoryFilterBar from "../../components/CategoryFilterBar";
import ProductCard from "../../components/ProductCard";
import PaginationControls from "../../components/PaginationControls";

export default function CollectionsScreen() {
    const [categories, setCategories] = useState<any[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [error, setError] = useState<string | null>(null);

    const scrollViewRef = useRef<ScrollView>(null);
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:4000";

    const fetchCategories = async () => {
        try {
            const res = await fetch(`${apiUrl}/api/v1/public/categories`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setCategories(data);
            }
        } catch (err) {
            console.error("Failed to fetch categories", err);
        }
    };

    const fetchProducts = async () => {
        setLoading(true);
        setError(null);
        try {
            let url = `${apiUrl}/api/v1/public/products?page=${page}&limit=20`;
            if (selectedCategory) {
                url += `&category=${selectedCategory}`;
            }

            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch products");

            const data = await res.json();
            setProducts(data.products || []);
            setTotalPages(data.totalPages || 1);
        } catch (err) {
            console.error(err);
            setError("Failed to load products. Please check your connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    useEffect(() => {
        fetchProducts();
    }, [page, selectedCategory]);

    const handleCategorySelect = (slug: string | null) => {
        if (selectedCategory === slug) return;
        setSelectedCategory(slug);
        setPage(1); // Reset to page 1 on category change
    };

    const handlePageChange = (newPage: number) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setPage(newPage);
            setTimeout(() => {
                scrollViewRef.current?.scrollTo({ y: 0, animated: true });
            }, 100);
        }
    };

    return (
        <SafeAreaView edges={['top']} className="flex-1 bg-white">
            <View className="p-4 bg-white border-b border-gray-100">
                <Text className="text-2xl font-bold text-primary">Collections</Text>
            </View>

            <CategoryFilterBar
                categories={categories}
                selectedSlug={selectedCategory}
                onSelect={handleCategorySelect}
            />

            <ScrollView
                ref={scrollViewRef}
                refreshControl={
                    <RefreshControl refreshing={loading} onRefresh={fetchProducts} colors={["#c0a080"]} />
                }
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {/* Product Grid */}
                {loading && products.length === 0 ? (
                    <View className="py-20">
                        <ActivityIndicator size="large" color="#c0a080" />
                    </View>
                ) : error ? (
                    <View className="py-20 px-6 items-center">
                        <Text className="text-red-500 text-center mb-4">{error}</Text>
                        <PaginationControls
                            page={page}
                            totalPages={totalPages}
                            onNext={() => { }}
                            onPrev={() => { }}
                            loading={false}
                        />
                    </View>
                ) : products.length === 0 ? (
                    <View className="py-20 px-6 items-center">
                        <Text className="text-gray-500 text-lg text-center">No products found in this category.</Text>
                    </View>
                ) : (
                    <View className="flex-row flex-wrap justify-between px-4 mt-2">
                        {products.map((product: any) => (
                            <View key={product.id} className="w-[48%] mb-4">
                                <ProductCard
                                    id={product.id}
                                    title={product.title}
                                    price={product.price}
                                    image={product.images && JSON.parse(product.images)[0]}
                                    slug={product.slug}
                                />
                            </View>
                        ))}
                    </View>
                )}

                {/* Pagination */}
                {!loading && products.length > 0 && (
                    <PaginationControls
                        page={page}
                        totalPages={totalPages}
                        onNext={() => handlePageChange(page + 1)}
                        onPrev={() => handlePageChange(page - 1)}
                        loading={loading}
                    />
                )}
            </ScrollView>
        </SafeAreaView>
    );
}
