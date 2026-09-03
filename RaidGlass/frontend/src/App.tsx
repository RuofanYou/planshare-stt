import { BrowserRouter as Router, Outlet, Routes, Route } from 'react-router-dom';
import { createRoot } from "react-dom/client";
import { Provider } from 'react-redux'
import { StrictMode, lazy, Suspense } from "react"
import { HelmetProvider } from "react-helmet-async";
import data_store from "./store/store"
import Footer from "./components/Footer/Footer";
import GlobalDataLoader from "./components/GlobalDataLoader";
import ProductShell from "./components/ProductShell/ProductShell";
import BootstrapBoundary from "./components/BootstrapBoundary";

import "../scss/main.scss"

// Delayed Imports
const Admin = lazy(() => import("./routes/Admin/Admin"));
const CompRankings = lazy(() => import("./routes/CompRankings/CompRankings"));
const CompSearch = lazy(() => import("./routes/CompSearch"));
const DesignPreviews = lazy(() => import("./routes/DesignPreviews/DesignPreviews"));
const Help = lazy(() => import("./routes/Help/Help"))
const Index = lazy(() => import("./routes/Index/Index"));
const RouteStatePage = lazy(() => import("./routes/RouteStatePage"));


////////////////////////////////////////////////////////////////////////////////
// APP
//

function App() {

    ////////////////////////
    // Output
    return (
        <HelmetProvider>
            <Provider store={data_store}>
                <StrictMode>

                    <GlobalDataLoader />

                    <Router basename="/log">
                        <ProductShell>
                            <Suspense fallback={(
                                <div className="rg-page-skeleton" role="status" aria-live="polite">
                                    正在载入作业库...
                                </div>
                            )}>
                                <Routes>
                                    <Route element={(
                                        <BootstrapBoundary>
                                            <Outlet />
                                        </BootstrapBoundary>
                                    )}>

                                        {/* Top10 Workbench */}
                                        <Route path="/spec_ranking/:spec_slug/:boss_slug" element={<Index />} />

                                        {/* Comp Rankings */}
                                        <Route path="/comp_ranking/search" element={<CompSearch />} />
                                        <Route path="/comp_ranking/:boss_slug" element={<CompRankings />} />

                                        {/* Home */}
                                        <Route path="/" element={<Index />} />
                                        {import.meta.env.DEV && (
                                            <Route path="/lorgmin/*" element={<Admin />} />
                                        )}
                                    </Route>

                                    {/* Public recovery routes */}
                                    <Route path="/user_report/*" element={<RouteStatePage kind="report-unavailable" />} />
                                    <Route path="/help" element={<Help />} />
                                    {import.meta.env.DEV && (
                                        <Route path="/design-previews" element={<DesignPreviews />} />
                                    )}
                                    <Route path="*" element={<RouteStatePage kind="not-found" />} />
                                </Routes>
                            </Suspense>
                        </ProductShell>
                        <Footer />
                    </Router>

                </StrictMode>
            </Provider>
        </HelmetProvider>
    )
}

const root = createRoot(document.getElementById("app_root")!);
root.render(<App />);
