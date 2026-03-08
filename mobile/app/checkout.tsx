
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";
import { useCart } from "../context/CartContext";

export default function CheckoutScreen() {
    const router = useRouter();
    const { clearCart, total } = useCart();
    const [processing, setProcessing] = useState(false);

    const handleCheckout = () => {
        setProcessing(true);
        setTimeout(() => {
            clearCart();
            setProcessing(false);
            alert("Order placed successfully!");
            router.replace("/(tabs)");
        }, 2000);
    };

    return (
        <SafeAreaView className="flex-1 bg-white items-center justify-center p-5">
            <Text className="text-2xl font-bold mb-2">Checkout</Text>
            <Text className="text-gray-500 mb-10">Total Amount: ${total.toFixed(2)}</Text>

            {processing ? (
                <ActivityIndicator size="large" color="#000" />
            ) : (
                <TouchableOpacity
                    className="w-full bg-black py-4 rounded-full items-center"
                    onPress={handleCheckout}
                >
                    <Text className="text-white font-bold text-lg">Pay Now</Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}
