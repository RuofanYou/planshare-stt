
import { useAppSelector } from '../../store/store_hooks'
import { ZH_CN } from '../../localization/zhCN'
import FormGroup from './FormGroup'
import SearchCountInput from './SearchCountInput'


/**
 * Group to search by role
 */
export default function PlayerRoleSearch() {

    let roles_map = useAppSelector(state => state.roles)
    let roles = Object.values(roles_map).filter(role => role.id < 1000)

    return (
        <FormGroup name={ZH_CN.comp.roleCounts} className="player-role-search">
            {roles.map((role) => {
                const label = ZH_CN.comp.roles[role.code];
                if (!label) return null;
                return (
                    <SearchCountInput
                        key={role.code}
                        fieldBase={`comp.role.${role.code}`}
                        label={label}
                        iconPath={role.icon_path}
                        classSlug={role.code}
                    />
                );
            })}
        </FormGroup>
    )
}
