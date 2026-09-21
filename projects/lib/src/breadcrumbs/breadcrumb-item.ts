/*
 * Copyright (c) 2025. Aeontronix Inc
 */

export interface BreadcrumbItem {
    label?: string;
    icon?: string;
    id?: string;
    url?: string;
    routerLink?: any;
    queryParams?: { [key: string]: any };
    fragment?: string;
    queryParamsHandling?: 'merge' | 'preserve' | '';
    preserveFragment?: boolean;
    skipLocationChange?: boolean;
    replaceUrl?: boolean;
    state?: { [key: string]: any };
    routerLinkActiveOptions?: any;
    target?: string;
    title?: string;
    tooltip?: string;
    tooltipPosition?: string;
    badge?: string;
    badgeStyleClass?: string;
    style?: { [key: string]: any };
    styleClass?: string;
    disabled?: boolean;
    visible?: boolean;
    expanded?: boolean;
    separator?: boolean;
    escape?: boolean;
    items?: BreadcrumbItem[];
    command?: (event?: any) => void;
}
