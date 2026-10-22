import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
  featuresManagementService,
  type FeatureContestRow,
  type FeatureCouponRow,
  type FeaturePrizeRow,
} from "../../../services/featuresManagementService";
import {
  asyncState,
  runQuery,
  type AsyncState,
} from "../../../shared/contracts/ui.contracts";

type FeaturesData = {
  contests: FeatureContestRow[];
  prizes: FeaturePrizeRow[];
  coupons: FeatureCouponRow[];
};

/**
 * useFeaturesManagementData — بيانات قسم إدارة الميزات (P10).
 * Loads the contests / prizes / coupons lists for the admin section. كل مصدر يقرأ من alx_api فقط؛
 * لا تقرأ الواجهة قاعدة البيانات مباشرة ولا تقرر الأهلية (منطق الأعمال خادمي بالكامل).
 * Every source reads through alx_api only; the UI never queries the DB and never decides eligibility.
 */
export function useFeaturesManagementData(isAr: boolean) {
  const [queryState, setQueryState] = useState<AsyncState<FeaturesData>>(
    asyncState.loading()
  );
  const [contests, setContests] = useState<FeatureContestRow[]>([]);
  const [prizes, setPrizes] = useState<FeaturePrizeRow[]>([]);
  const [coupons, setCoupons] = useState<FeatureCouponRow[]>([]);

  const loadAllData = useCallback(async () => {
    const result = await runQuery(
      async () => {
        const [c, p, cu] = await Promise.all([
          featuresManagementService.listContests(),
          featuresManagementService.listPrizes(),
          featuresManagementService.listCoupons(),
        ]);
        return { contests: c, prizes: p, coupons: cu };
      },
      setQueryState,
      () => false
    );

    if (result.status === "success") {
      setContests(result.data.contests);
      setPrizes(result.data.prizes);
      setCoupons(result.data.coupons);
    } else if (result.status === "error") {
      console.error(
        "[FeaturesManagement] Error loading features data:",
        result.error
      );
      toast.error(
        isAr
          ? "حدث خطأ أثناء تحميل بيانات الميزات"
          : "Error loading features data"
      );
    }
  }, [isAr]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  return {
    loading: queryState.status === "loading",
    contests,
    prizes,
    coupons,
    setContests,
    setPrizes,
    setCoupons,
    reload: loadAllData,
  };
}

export default useFeaturesManagementData;
