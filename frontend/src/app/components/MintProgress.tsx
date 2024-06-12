// components/MintProgress.tsx

import { useChoiceStore } from "../useChoiceStore";

export default function MintProgress() {
  const { initialTokens, mintRemaining, burnedAmount } = useChoiceStore(
    (state) => state
  );
  const mintedTokens = initialTokens - mintRemaining;

  const mintedPercentage = (mintedTokens / initialTokens) * 100;
  const burnedPercentage = (burnedAmount / initialTokens) * 100;

  return (
    <div className="w-full mt-16 px-4 text-white">
      <h2 className="text-center text-2xl font-bold mb-2">Mint Progress</h2>
      <div className="h-6 p-1 w-full rounded-full overflow-hidden bg-white shadow">
        <div className="relative w-full h-4 bg-gray-200 shadow-inner rounded-full overflow-hidden">
          <div
            className="absolute left-0 h-full bg-nice-600 border-r-2 border-white shadow-[0px_0px_3px_0px_rgb(0,0,0,0.3)]"
            style={{ width: `${mintedPercentage + burnedPercentage}%` }}
          ></div>
          <div
            className="absolute left-0 h-full bg-naughty-600 border-r-2 border-white shadow-[0px_0px_3px_0px_rgb(0,0,0,0.3)]"
            style={{ width: `${burnedPercentage}%` }}
          ></div>
        </div>
      </div>
      {/* <div className="text-white text-xs w-full max-w-sm flex gap-4 font-semibold">
        <div>
          {burnedAmount} Burned, {mintedTokens} Minted
        </div>
        <div>of</div>
        <div></div>
        <div>/</div>
        <div>{initialTokens}</div>
      </div> */}
    </div>
  );
}
