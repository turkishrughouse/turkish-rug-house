
import { View, Text, ScrollView, TouchableOpacity, Image, SafeAreaView } from "react-native";
import { useCart } from "../../context/CartContext";
import { Trash2 } from "lucide-react-native";
import { useRouter } from "expo-router";

export default function CartScreen() {
    const { items, removeFromCart, total } = useCart();
    const router = useRouter();

    if (items.length === 0) {
        return (
            <SafeAreaView className="flex-1 bg-white justify-center items-center">
                <Text className="text-xl font-medium text-gray-400">Your cart is empty</Text>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="p-4 border-b border-gray-100">
                <Text className="text-2xl font-bold">Shopping Cart</Text>
            </View>

            <ScrollView className="flex-1 p-4">
                {items.map((item) => (
                    <View key={item.id} className="flex-row mb-4 bg-white rounded-lg shadow-sm border border-gray-100 p-3">
                        {item.image && (
                            <Image
                                source={{ uri: item.image }}
                                className="w-20 h-20 rounded-md bg-gray-100 mr-3"
                            />
                        )}
                        <View className="flex-1 justify-between">
                            <View>
                                <Text className="font-medium text-base mb-1" numberOfLines={1}>{item.title}</Text>
                                <Text className="text-gray-500 text-sm">Quantity: {item.quantity}</Text>
                            </View>
                            <View className="flex-row justify-between items-end">
                                <Text className="font-bold text-lg">${(item.price * item.quantity).toFixed(2)}</Text>
                                <TouchableOpacity onPress={() => removeFromCart(item.id)} className="p-2">
                                    <Trash2 size={18} color="red" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))}
            </ScrollView>

            <View className="p-4 border-t border-gray-100 bg-white">
                <View className="flex-row justify-between mb-4">
                    <Text className="text-lg font-medium text-gray-500">Total</Text>
                    <Text className="text-2xl font-bold text-black">${total.toFixed(2)}</Text>
                </View>
                <TouchableOpacity
                    className="w-full bg-black py-4 rounded-full items-center"
                    onPress={() => router.push("/checkout")}
                >
                    <Text className="text-white font-bold text-lg">Checkout</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
