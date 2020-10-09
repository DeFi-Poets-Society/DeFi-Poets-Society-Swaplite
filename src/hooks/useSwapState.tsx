import { useCallback, useContext, useEffect, useState } from "react";

import { Trade } from "@sushiswap/sdk";
import { EthersContext } from "../context/EthersContext";
import { parseBalance } from "../utils";
import useSDK from "./useSDK";
import useTokenPairState, { TokenPairState } from "./useTokenPairState";

export interface SwapState extends TokenPairState {
    trade?: Trade;
    unsupported: boolean;
    onSwap: () => Promise<void>;
    swapping: boolean;
}

// tslint:disable-next-line:max-func-body-length
const useSwapState: () => SwapState = () => {
    const state = useTokenPairState();
    const { signer, addOnBlockListener, removeOnBlockListener, updateTokens } = useContext(EthersContext);
    const { getTrade, swap } = useSDK();
    const [loading, setLoading] = useState(true);
    const [trade, setTrade] = useState<Trade>();
    const [unsupported, setUnsupported] = useState(false);
    const [swapping, setSwapping] = useState(false);

    useEffect(() => {
        if (state.fromSymbol && state.toSymbol && state.fromAmount) {
            const updateTrade = async () => {
                if (state.fromToken && state.toToken && state.fromAmount && signer?.provider) {
                    const amount = parseBalance(state.fromAmount, state.fromToken.decimals);
                    if (!amount.isZero()) {
                        setUnsupported(false);
                        try {
                            setTrade(await getTrade(state.fromToken, state.toToken, amount, signer?.provider));
                        } catch (e) {
                            setUnsupported(true);
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            };

            setLoading(true);
            updateTrade();
            const name = "updateTrade(" + state.fromSymbol + "," + state.toSymbol + "," + state.fromAmount + ")";

            addOnBlockListener(name, updateTrade);
            return () => {
                removeOnBlockListener(name);
            };
        }
    }, [state.fromSymbol, state.toSymbol, state.fromAmount]);

    const onSwap = useCallback(async () => {
        if (state.fromToken && state.toToken && state.fromAmount && signer && trade) {
            setSwapping(true);
            try {
                const result = await swap(trade, signer);
                if (result) {
                    await result.tx.wait();
                    await updateTokens();
                    state.setFromSymbol("");
                }
            } finally {
                setSwapping(false);
            }
        }
    }, [state.fromToken, state.toToken, state.fromAmount, signer, trade]);

    return {
        ...state,
        loading: loading || state.loading,
        trade,
        unsupported,
        onSwap,
        swapping
    };
};

export default useSwapState;
