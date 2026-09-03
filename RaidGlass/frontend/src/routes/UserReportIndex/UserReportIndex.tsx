import FightSelectGrid from "../../components/ReportNavbar/FightSelectList"
import HeaderLogo from "../../components/HeaderLogo"
import LoadingOverlay from "../../components/shared/LoadingOverlay"
import PlayerSelectGrid from "../../components/ReportNavbar/PlayerSelectList"
import UrlInput from "./UrlInput"
import styles from "./UserReportIndex.module.scss"
import { SubmitButton } from "./SubmitButton";
import { get_is_loading } from "../../store/user_reports"
import { useAppSelector } from "../../store/store_hooks"
import { useForm, FormProvider } from "react-hook-form";


export default function UserReportIndex() {

    ////////////////////////////////
    // Hooks
    //
    const is_loading = useAppSelector(get_is_loading)
    const form_methods  = useForm();

    ////////////////////////////////
    // Render
    //
    return (
        <div className="d-flex justify-content-center">

            <FormProvider {...form_methods}>
            <form className={`${styles.container} mt-5`}>

                {/* Header */}
                <h2 className="m-0 gap-2 d-flex align-items-center wow-artifact">
                    <HeaderLogo wow_class="wow-artifact" />
                    <span>导入 WCL 报告</span>
                </h2>

                {/* URL Input */}
                <div>
                    <h4 className="mb-1">报告链接</h4>
                    <UrlInput />
                </div>

                {is_loading && <LoadingOverlay />}

                <div className={`d-flex gap-4 justify-content-center  ${is_loading ? "loading_trans" : ""} `}>
                    <FightSelectGrid />
                    <PlayerSelectGrid />
                </div>

                <div className="mt-3 d-flex ">

                    <div className={styles.patreon_info}>
                        选择一次或多次战斗，再选择要看的玩家，即可生成独立时间轴。
                    </div>

                    <div className="ml-auto">
                        <SubmitButton />
                    </div>

                </div>

            </form>
            </FormProvider>
        </div>
    )
}
