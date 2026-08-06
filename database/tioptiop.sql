-- =====================================================================
-- TIOPTIOP - BASE COMPLETE MYSQL / MARIADB - XAMPP
-- Version 1.1 corrigée
-- Compatible phpMyAdmin / XAMPP (MySQL 8 ou MariaDB récent)
-- =====================================================================

SET NAMES utf8mb4;
SET time_zone = '+01:00';
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS tioptiop
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE tioptiop;

-- ---------------------------------------------------------------------
-- Suppression des tables dans l'ordre inverse des dépendances
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS system_settings;
DROP TABLE IF EXISTS admin_user_roles;
DROP TABLE IF EXISTS role_permissions;
DROP TABLE IF EXISTS permissions;
DROP TABLE IF EXISTS roles;

DROP TABLE IF EXISTS job_application_documents;
DROP TABLE IF EXISTS job_applications;
DROP TABLE IF EXISTS jobs;

DROP TABLE IF EXISTS faq_items;
DROP TABLE IF EXISTS cms_pages;

DROP TABLE IF EXISTS support_messages;
DROP TABLE IF EXISTS support_tickets;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS product_reviews;
DROP TABLE IF EXISTS favorites;

DROP TABLE IF EXISTS loyalty_transactions;
DROP TABLE IF EXISTS loyalty_accounts;
DROP TABLE IF EXISTS loyalty_rewards;

DROP TABLE IF EXISTS delivery_tracking_points;
DROP TABLE IF EXISTS deliveries;

DROP TABLE IF EXISTS payment_events;
DROP TABLE IF EXISTS payments;

DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS order_item_options;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;

DROP TABLE IF EXISTS promotion_categories;
DROP TABLE IF EXISTS promotion_products;
DROP TABLE IF EXISTS promotions;

DROP TABLE IF EXISTS formula_images;
DROP TABLE IF EXISTS formula_items;
DROP TABLE IF EXISTS formulas;

DROP TABLE IF EXISTS product_option_values;
DROP TABLE IF EXISTS product_option_groups;
DROP TABLE IF EXISTS restaurant_products;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;

DROP TABLE IF EXISTS delivery_zones;
DROP TABLE IF EXISTS restaurant_opening_hours;
DROP TABLE IF EXISTS restaurants;

DROP TABLE IF EXISTS user_payment_methods;
DROP TABLE IF EXISTS user_addresses;
DROP TABLE IF EXISTS user_profiles;
DROP TABLE IF EXISTS users;

DROP TABLE IF EXISTS admin_users;

-- =====================================================================
-- 1. CLIENTS / COMPTES
-- =====================================================================

CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    email VARCHAR(190) NULL,
    phone VARCHAR(40) NULL,
    password_hash VARCHAR(255) NULL,
    account_type ENUM('CUSTOMER','GUEST') NOT NULL DEFAULT 'CUSTOMER',
    status ENUM('ACTIVE','BLOCKED','DELETED','PENDING') NOT NULL DEFAULT 'ACTIVE',
    email_verified_at DATETIME NULL,
    phone_verified_at DATETIME NULL,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_users_public_id (public_id),
    UNIQUE KEY uq_users_email (email),
    UNIQUE KEY uq_users_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_profiles (
    user_id BIGINT UNSIGNED NOT NULL,
    first_name VARCHAR(100) NULL,
    last_name VARCHAR(100) NULL,
    display_name VARCHAR(160) NULL,
    avatar_url TEXT NULL,
    birth_date DATE NULL,
    preferred_language VARCHAR(10) NOT NULL DEFAULT 'fr',
    marketing_consent TINYINT(1) NOT NULL DEFAULT 0,
    push_consent TINYINT(1) NOT NULL DEFAULT 1,
    email_consent TINYINT(1) NOT NULL DEFAULT 1,
    motif_theme VARCHAR(40) NOT NULL DEFAULT 'KONGO_AUTHENTIQUE',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_user_profiles_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_addresses (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    label VARCHAR(80) NOT NULL DEFAULT 'Maison',
    recipient_name VARCHAR(160) NULL,
    phone VARCHAR(40) NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255) NULL,
    district VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL DEFAULT 'Brazzaville',
    country_code CHAR(2) NOT NULL DEFAULT 'CG',
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    delivery_instructions TEXT NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_user_addresses_user (user_id),
    CONSTRAINT fk_user_addresses_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE user_payment_methods (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    provider VARCHAR(60) NOT NULL,
    method_type ENUM('CARD','MOBILE_MONEY') NOT NULL,
    label VARCHAR(100) NULL,
    token_reference VARCHAR(255) NULL,
    masked_value VARCHAR(100) NULL,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    expires_month TINYINT UNSIGNED NULL,
    expires_year SMALLINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payment_methods_user (user_id),
    CONSTRAINT fk_payment_methods_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 2. ADMINISTRATION / ROLES
-- =====================================================================

CREATE TABLE admin_users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    email VARCHAR(190) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(160) NOT NULL,
    phone VARCHAR(40) NULL,
    avatar_url TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_admin_public_id (public_id),
    UNIQUE KEY uq_admin_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE roles (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT NULL,
    is_system TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE permissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    code VARCHAR(120) NOT NULL,
    label VARCHAR(180) NOT NULL,
    module VARCHAR(80) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_permissions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE role_permissions (
    role_id BIGINT UNSIGNED NOT NULL,
    permission_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    CONSTRAINT fk_role_permissions_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_role_permissions_permission
        FOREIGN KEY (permission_id) REFERENCES permissions(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE admin_user_roles (
    admin_user_id BIGINT UNSIGNED NOT NULL,
    role_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (admin_user_id, role_id),
    CONSTRAINT fk_admin_user_roles_user
        FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_admin_user_roles_role
        FOREIGN KEY (role_id) REFERENCES roles(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 3. RESTAURANTS
-- =====================================================================

CREATE TABLE restaurants (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    code VARCHAR(30) NOT NULL,
    name VARCHAR(180) NOT NULL,
    description TEXT NULL,
    phone VARCHAR(40) NULL,
    email VARCHAR(190) NULL,
    address VARCHAR(255) NOT NULL,
    district VARCHAR(120) NULL,
    city VARCHAR(120) NOT NULL DEFAULT 'Brazzaville',
    country_code CHAR(2) NOT NULL DEFAULT 'CG',
    latitude DECIMAL(10,7) NULL,
    longitude DECIMAL(10,7) NULL,
    hero_image_url TEXT NULL,
    logo_url TEXT NULL,
    supports_delivery TINYINT(1) NOT NULL DEFAULT 1,
    supports_pickup TINYINT(1) NOT NULL DEFAULT 1,
    supports_dine_in TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('OPEN','CLOSED','COMING_SOON','SUSPENDED') NOT NULL DEFAULT 'OPEN',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_restaurants_public_id (public_id),
    UNIQUE KEY uq_restaurants_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE restaurant_opening_hours (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    day_of_week TINYINT UNSIGNED NOT NULL,
    open_time TIME NULL,
    close_time TIME NULL,
    is_closed TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    UNIQUE KEY uq_restaurant_day (restaurant_id, day_of_week),
    CONSTRAINT fk_opening_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_zones (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(160) NOT NULL,
    min_order DECIMAL(12,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    free_delivery_from DECIMAL(12,2) NULL,
    estimated_min_minutes INT UNSIGNED NOT NULL DEFAULT 20,
    estimated_max_minutes INT UNSIGNED NOT NULL DEFAULT 40,
    polygon_geojson JSON NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_delivery_zone_restaurant (restaurant_id),
    CONSTRAINT fk_delivery_zone_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 4. CATALOGUE
-- =====================================================================

CREATE TABLE categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(140) NOT NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    icon VARCHAR(80) NULL,
    position INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_categories_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    sku VARCHAR(60) NULL,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    short_description VARCHAR(300) NULL,
    description TEXT NULL,
    price DECIMAL(12,2) NOT NULL,
    compare_at_price DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    preparation_minutes INT UNSIGNED NOT NULL DEFAULT 15,
    spice_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
    allergens TEXT NULL,
    ingredients TEXT NULL,
    calories INT UNSIGNED NULL,
    is_halal TINYINT(1) NOT NULL DEFAULT 0,
    is_vegetarian TINYINT(1) NOT NULL DEFAULT 0,
    is_breakfast TINYINT(1) NOT NULL DEFAULT 0,
    breakfast_start TIME NULL,
    breakfast_end TIME NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    position INT NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_products_public_id (public_id),
    UNIQUE KEY uq_products_sku (sku),
    UNIQUE KEY uq_products_slug (slug),
    KEY idx_products_category (category_id),
    KEY idx_products_active (is_active),
    CONSTRAINT fk_products_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    image_url TEXT NOT NULL,
    source_url TEXT NULL,
    alt_text VARCHAR(255) NULL,
    position INT NOT NULL DEFAULT 0,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_product_images_product (product_id),
    CONSTRAINT fk_product_images_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE restaurant_products (
    restaurant_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    price_override DECIMAL(12,2) NULL,
    stock_quantity INT NULL,
    is_available TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (restaurant_id, product_id),
    CONSTRAINT fk_restaurant_products_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_restaurant_products_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_option_groups (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    product_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    selection_type ENUM('SINGLE','MULTIPLE') NOT NULL,
    is_required TINYINT(1) NOT NULL DEFAULT 0,
    min_select INT UNSIGNED NOT NULL DEFAULT 0,
    max_select INT UNSIGNED NULL,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_option_groups_product (product_id),
    CONSTRAINT fk_option_groups_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_option_values (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    option_group_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(150) NOT NULL,
    price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
    is_default TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    position INT NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_option_values_group (option_group_id),
    CONSTRAINT fk_option_values_group
        FOREIGN KEY (option_group_id) REFERENCES product_option_groups(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 5. FORMULES / MENUS
-- =====================================================================

CREATE TABLE formulas (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    description TEXT NULL,
    price DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    is_featured TINYINT(1) NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_formulas_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formula_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    formula_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    label VARCHAR(160) NULL,
    quantity INT UNSIGNED NOT NULL DEFAULT 1,
    is_optional TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_formula_items_formula (formula_id),
    CONSTRAINT fk_formula_items_formula
        FOREIGN KEY (formula_id) REFERENCES formulas(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_formula_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE formula_images (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    formula_id BIGINT UNSIGNED NOT NULL,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255) NULL,
    position INT NOT NULL DEFAULT 0,
    is_primary TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_formula_images_formula (formula_id),
    CONSTRAINT fk_formula_images_formula
        FOREIGN KEY (formula_id) REFERENCES formulas(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 6. PROMOTIONS
-- =====================================================================

CREATE TABLE promotions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    code VARCHAR(80) NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    discount_type ENUM('PERCENT','FIXED','FREE_DELIVERY','POINTS_MULTIPLIER') NOT NULL,
    discount_value DECIMAL(12,2) NOT NULL DEFAULT 0,
    minimum_order DECIMAL(12,2) NULL,
    audience ENUM('ALL','TIOP_PLUS','NEW_CUSTOMERS','SELECTED') NOT NULL DEFAULT 'ALL',
    usage_limit INT UNSIGNED NULL,
    usage_limit_per_user INT UNSIGNED NULL,
    starts_at DATETIME NULL,
    ends_at DATETIME NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_promotions_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_products (
    promotion_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (promotion_id, product_id),
    CONSTRAINT fk_promotion_products_promotion
        FOREIGN KEY (promotion_id) REFERENCES promotions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_promotion_products_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE promotion_categories (
    promotion_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (promotion_id, category_id),
    CONSTRAINT fk_promotion_categories_promotion
        FOREIGN KEY (promotion_id) REFERENCES promotions(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_promotion_categories_category
        FOREIGN KEY (category_id) REFERENCES categories(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 7. COMMANDES
-- =====================================================================

CREATE TABLE orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    reference VARCHAR(60) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    delivery_address_id BIGINT UNSIGNED NULL,
    order_type ENUM('DELIVERY','PICKUP','DINE_IN') NOT NULL,
    channel ENUM('WEB','MOBILE','POS','PHONE','WHATSAPP','ADMIN') NOT NULL DEFAULT 'WEB',
    status ENUM(
        'RECEIVED','CONFIRMED','PREPARING','READY',
        'PICKED_UP','ON_THE_WAY','DELIVERED',
        'CANCELLED','REFUNDED'
    ) NOT NULL DEFAULT 'RECEIVED',
    subtotal DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    delivery_fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    promo_code VARCHAR(80) NULL,
    customer_note TEXT NULL,
    scheduled_for DATETIME NULL,
    accepted_at DATETIME NULL,
    prepared_at DATETIME NULL,
    delivered_at DATETIME NULL,
    cancelled_at DATETIME NULL,
    cancellation_reason TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_orders_public_id (public_id),
    UNIQUE KEY uq_orders_reference (reference),
    KEY idx_orders_user (user_id),
    KEY idx_orders_restaurant (restaurant_id),
    KEY idx_orders_status (status),
    KEY idx_orders_created_at (created_at),
    CONSTRAINT fk_orders_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_orders_restaurant
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
    CONSTRAINT fk_orders_address
        FOREIGN KEY (delivery_address_id) REFERENCES user_addresses(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NULL,
    formula_id BIGINT UNSIGNED NULL,
    product_name VARCHAR(180) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    line_total DECIMAL(12,2) NOT NULL,
    notes TEXT NULL,
    PRIMARY KEY (id),
    KEY idx_order_items_order (order_id),
    CONSTRAINT fk_order_items_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_items_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_order_items_formula
        FOREIGN KEY (formula_id) REFERENCES formulas(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_item_options (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_item_id BIGINT UNSIGNED NOT NULL,
    option_name VARCHAR(150) NOT NULL,
    option_value VARCHAR(150) NOT NULL,
    price_delta DECIMAL(12,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_order_item_options_item (order_item_id),
    CONSTRAINT fk_order_item_options_item
        FOREIGN KEY (order_item_id) REFERENCES order_items(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE order_status_history (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    status VARCHAR(30) NOT NULL,
    comment TEXT NULL,
    changed_by_user_id BIGINT UNSIGNED NULL,
    changed_by_admin_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_order_history_order (order_id),
    CONSTRAINT fk_order_history_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_order_history_user
        FOREIGN KEY (changed_by_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_order_history_admin
        FOREIGN KEY (changed_by_admin_user_id) REFERENCES admin_users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 8. PAIEMENTS
-- =====================================================================

CREATE TABLE payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    order_id BIGINT UNSIGNED NOT NULL,
    method ENUM('CARD','MOBILE_MONEY','CASH') NOT NULL,
    provider VARCHAR(80) NULL,
    status ENUM('PENDING','AUTHORIZED','PAID','FAILED','CANCELLED','PARTIAL','REFUNDED') NOT NULL DEFAULT 'PENDING',
    amount DECIMAL(12,2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    provider_reference VARCHAR(180) NULL,
    collected_by_admin_user_id BIGINT UNSIGNED NULL,
    paid_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_payments_public_id (public_id),
    KEY idx_payments_order (order_id),
    CONSTRAINT fk_payments_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_payments_collector
        FOREIGN KEY (collected_by_admin_user_id) REFERENCES admin_users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE payment_events (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    payment_id BIGINT UNSIGNED NOT NULL,
    event_type VARCHAR(60) NOT NULL,
    description TEXT NULL,
    payload JSON NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_payment_events_payment (payment_id),
    CONSTRAINT fk_payment_events_payment
        FOREIGN KEY (payment_id) REFERENCES payments(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 9. LIVRAISONS / TRACKING GPS
-- =====================================================================

CREATE TABLE deliveries (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    driver_name VARCHAR(160) NULL,
    driver_phone VARCHAR(40) NULL,
    driver_user_id BIGINT UNSIGNED NULL,
    status ENUM('WAITING','ASSIGNED','PICKED_UP','ON_THE_WAY','ARRIVED','DELIVERED','FAILED') NOT NULL DEFAULT 'WAITING',
    estimated_arrival DATETIME NULL,
    picked_up_at DATETIME NULL,
    arrived_at DATETIME NULL,
    delivered_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_deliveries_order (order_id),
    CONSTRAINT fk_deliveries_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_deliveries_driver
        FOREIGN KEY (driver_user_id) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE delivery_tracking_points (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    delivery_id BIGINT UNSIGNED NOT NULL,
    latitude DECIMAL(10,7) NOT NULL,
    longitude DECIMAL(10,7) NOT NULL,
    heading DECIMAL(6,2) NULL,
    speed_kmh DECIMAL(7,2) NULL,
    accuracy_meters DECIMAL(8,2) NULL,
    recorded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_tracking_delivery_time (delivery_id, recorded_at),
    CONSTRAINT fk_tracking_delivery
        FOREIGN KEY (delivery_id) REFERENCES deliveries(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 10. TIOP+ / FIDELITE
-- =====================================================================

CREATE TABLE loyalty_rewards (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(180) NOT NULL,
    description TEXT NULL,
    image_url TEXT NULL,
    points_cost INT UNSIGNED NOT NULL,
    reward_type ENUM('PRODUCT','DISCOUNT','FREE_DELIVERY','COUPON') NOT NULL,
    reward_value DECIMAL(12,2) NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE loyalty_accounts (
    user_id BIGINT UNSIGNED NOT NULL,
    points_balance INT NOT NULL DEFAULT 0,
    tier VARCHAR(30) NOT NULL DEFAULT 'TIOP',
    subscribed_at DATETIME NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id),
    CONSTRAINT fk_loyalty_account_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE loyalty_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NULL,
    reward_id BIGINT UNSIGNED NULL,
    transaction_type ENUM('EARN','SPEND','ADJUSTMENT','EXPIRE') NOT NULL,
    points INT NOT NULL,
    description TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_loyalty_transactions_user (user_id),
    CONSTRAINT fk_loyalty_transactions_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_loyalty_transactions_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_loyalty_transactions_reward
        FOREIGN KEY (reward_id) REFERENCES loyalty_rewards(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 11. FAVORIS / AVIS / NOTIFICATIONS
-- =====================================================================

CREATE TABLE favorites (
    user_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, product_id),
    CONSTRAINT fk_favorites_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_favorites_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE product_reviews (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    product_id BIGINT UNSIGNED NOT NULL,
    order_id BIGINT UNSIGNED NULL,
    rating TINYINT UNSIGNED NOT NULL,
    title VARCHAR(180) NULL,
    comment TEXT NULL,
    is_published TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_reviews_product (product_id),
    CONSTRAINT fk_reviews_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_reviews_product
        FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_reviews_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NULL,
    channel ENUM('IN_APP','PUSH','EMAIL','SMS') NOT NULL,
    notification_type VARCHAR(60) NOT NULL,
    title VARCHAR(180) NOT NULL,
    body TEXT NOT NULL,
    payload JSON NULL,
    read_at DATETIME NULL,
    sent_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifications_user_created (user_id, created_at),
    CONSTRAINT fk_notifications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 12. SUPPORT
-- =====================================================================

CREATE TABLE support_tickets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    reference VARCHAR(60) NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    order_id BIGINT UNSIGNED NULL,
    subject VARCHAR(180) NOT NULL,
    category VARCHAR(60) NOT NULL DEFAULT 'OTHER',
    priority ENUM('LOW','NORMAL','HIGH','URGENT') NOT NULL DEFAULT 'NORMAL',
    status ENUM('NEW','IN_PROGRESS','WAITING_CUSTOMER','RESOLVED','CLOSED') NOT NULL DEFAULT 'NEW',
    assigned_admin_user_id BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_support_reference (reference),
    KEY idx_support_status (status),
    CONSTRAINT fk_support_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_order
        FOREIGN KEY (order_id) REFERENCES orders(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_assignee
        FOREIGN KEY (assigned_admin_user_id) REFERENCES admin_users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE support_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    ticket_id BIGINT UNSIGNED NOT NULL,
    sender_type ENUM('CUSTOMER','ADMIN') NOT NULL,
    sender_user_id BIGINT UNSIGNED NULL,
    sender_admin_user_id BIGINT UNSIGNED NULL,
    message TEXT NOT NULL,
    attachment_url TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_support_messages_ticket (ticket_id),
    CONSTRAINT fk_support_messages_ticket
        FOREIGN KEY (ticket_id) REFERENCES support_tickets(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_support_messages_user
        FOREIGN KEY (sender_user_id) REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_support_messages_admin
        FOREIGN KEY (sender_admin_user_id) REFERENCES admin_users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 13. CARRIERES / CANDIDATURES
-- =====================================================================

CREATE TABLE jobs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    title VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL,
    department VARCHAR(120) NOT NULL,
    location VARCHAR(160) NOT NULL,
    contract_type VARCHAR(50) NOT NULL,
    experience_level VARCHAR(100) NULL,
    salary_min DECIMAL(12,2) NULL,
    salary_max DECIMAL(12,2) NULL,
    currency CHAR(3) NOT NULL DEFAULT 'XAF',
    description TEXT NOT NULL,
    responsibilities TEXT NULL,
    requirements TEXT NULL,
    benefits TEXT NULL,
    image_url TEXT NULL,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closes_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_jobs_public_id (public_id),
    UNIQUE KEY uq_jobs_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_applications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    public_id CHAR(36) NULL,
    reference VARCHAR(80) NOT NULL,
    job_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(190) NOT NULL,
    phone VARCHAR(40) NOT NULL,
    experience VARCHAR(255) NULL,
    availability VARCHAR(255) NULL,
    cover_message TEXT NULL,
    source VARCHAR(40) NOT NULL DEFAULT 'CAREERS_WEB',
    status ENUM('NEW','REVIEW','INTERVIEW','SHORTLISTED','REJECTED','HIRED') NOT NULL DEFAULT 'NEW',
    internal_note TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_job_applications_public_id (public_id),
    UNIQUE KEY uq_job_applications_reference (reference),
    KEY idx_job_applications_job (job_id),
    KEY idx_job_applications_status (status),
    CONSTRAINT fk_job_applications_job
        FOREIGN KEY (job_id) REFERENCES jobs(id),
    CONSTRAINT fk_job_applications_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE job_application_documents (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    application_id BIGINT UNSIGNED NOT NULL,
    document_type VARCHAR(30) NOT NULL DEFAULT 'CV',
    file_name VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT UNSIGNED NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_job_documents_application (application_id),
    CONSTRAINT fk_job_documents_application
        FOREIGN KEY (application_id) REFERENCES job_applications(id)
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 14. CMS / FAQ
-- =====================================================================

CREATE TABLE cms_pages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    slug VARCHAR(160) NOT NULL,
    title VARCHAR(200) NOT NULL,
    excerpt TEXT NULL,
    content_html LONGTEXT NOT NULL,
    hero_image_url TEXT NULL,
    seo_title VARCHAR(255) NULL,
    seo_description VARCHAR(350) NULL,
    status ENUM('DRAFT','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    published_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cms_pages_slug (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE faq_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category VARCHAR(100) NOT NULL DEFAULT 'GENERAL',
    question TEXT NOT NULL,
    answer_html TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    is_active TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- 15. PARAMETRES / JOURNAUX
-- =====================================================================

CREATE TABLE system_settings (
    setting_key VARCHAR(160) NOT NULL,
    setting_value JSON NOT NULL,
    description TEXT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    admin_user_id BIGINT UNSIGNED NULL,
    user_id BIGINT UNSIGNED NULL,
    action VARCHAR(160) NOT NULL,
    entity_type VARCHAR(100) NULL,
    entity_id VARCHAR(100) NULL,
    old_value JSON NULL,
    new_value JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_audit_admin (admin_user_id),
    KEY idx_audit_created (created_at),
    CONSTRAINT fk_audit_admin
        FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================================
-- FAKE DATA
-- =====================================================================

INSERT INTO users
(id, public_id, email, phone, password_hash, account_type, status)
VALUES
(1, UUID(), 'celestin@tioptiop.cg', '+242061002030', '$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH', 'CUSTOMER', 'ACTIVE'),
(2, UUID(), 'mireille@example.com', '+242050001122', '$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH', 'CUSTOMER', 'ACTIVE'),
(3, UUID(), 'junior@example.com', '+242062223344', '$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH', 'CUSTOMER', 'ACTIVE');

INSERT INTO user_profiles
(user_id, first_name, last_name, display_name, avatar_url, marketing_consent, motif_theme)
VALUES
(1,'Célestin','K.','Célestin K.','https://i.pravatar.cc/300?img=12',1,'KONGO_AUTHENTIQUE'),
(2,'Mireille','N.','Mireille N.','https://i.pravatar.cc/300?img=47',1,'AFRO_ELEGANT'),
(3,'Junior','M.','Junior M.','https://i.pravatar.cc/300?img=15',0,'CONGO_BRAZZAVILLE');

INSERT INTO user_addresses
(id,user_id,label,recipient_name,phone,address_line1,district,city,latitude,longitude,is_default)
VALUES
(1,1,'Maison','Célestin K.','+242061002030','Avenue de la Paix','Poto-Poto','Brazzaville',-4.2634000,15.2429000,1),
(2,2,'Maison','Mireille N.','+242050001122','Avenue Matsoua','Bacongo','Brazzaville',-4.2868000,15.2410000,1);

INSERT INTO admin_users
(id,public_id,email,password_hash,name,phone,avatar_url,is_active)
VALUES
(1,UUID(),'admin@tioptiop.cg','$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH','Admin TiopTiop','+242060000100','https://i.pravatar.cc/300?img=11',1),
(2,UUID(),'manager@tioptiop.cg','$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH','Manager Centre','+242060000101','https://i.pravatar.cc/300?img=32',1),
(3,UUID(),'support@tioptiop.cg','$2a$10$DEMO_REPLACE_WITH_REAL_BCRYPT_HASH','Support Team','+242060000102','https://i.pravatar.cc/300?img=45',1);

INSERT INTO roles (id,name,description,is_system) VALUES
(1,'SUPER_ADMIN','Accès total',1),
(2,'MANAGER','Gestion restaurant et opérations',1),
(3,'CASHIER','POS et caisse',1),
(4,'KITCHEN','Cuisine',1),
(5,'DRIVER','Livraisons',1),
(6,'SUPPORT','Support client',1),
(7,'MARKETING','Promotions, Tiop+ et CMS',1),
(8,'HR','Carrières et candidatures',1);

INSERT INTO permissions (code,label,module) VALUES
('dashboard.view','Voir le tableau de bord','DASHBOARD'),
('orders.read','Voir les commandes','ORDERS'),
('orders.update','Modifier les commandes','ORDERS'),
('orders.create_pos','Créer une commande POS','ORDERS'),
('payments.read','Voir les paiements','PAYMENTS'),
('payments.collect_cash','Encaisser les espèces','PAYMENTS'),
('products.read','Voir les produits','CATALOG'),
('products.write','Gérer les produits','CATALOG'),
('categories.write','Gérer les catégories','CATALOG'),
('formulas.write','Gérer les formules','CATALOG'),
('promotions.write','Gérer les promotions','MARKETING'),
('loyalty.write','Gérer Tiop+','MARKETING'),
('clients.read','Voir les clients','CLIENTS'),
('clients.write','Modifier les clients','CLIENTS'),
('support.read','Voir le support','SUPPORT'),
('support.write','Traiter le support','SUPPORT'),
('jobs.write','Gérer les emplois','HR'),
('applications.read','Voir les candidatures','HR'),
('applications.write','Traiter les candidatures','HR'),
('cms.write','Gérer les pages CMS','CMS'),
('faq.write','Gérer la FAQ','CMS'),
('restaurants.write','Gérer les restaurants','RESTAURANTS'),
('admin_users.write','Gérer les administrateurs','SYSTEM'),
('roles.write','Gérer les rôles','SYSTEM'),
('settings.write','Gérer les paramètres','SYSTEM'),
('audit.read','Voir les journaux','SYSTEM');

INSERT INTO role_permissions (role_id,permission_id)
SELECT 1,id FROM permissions;

INSERT INTO role_permissions (role_id,permission_id)
SELECT 8,id FROM permissions WHERE module='HR';

INSERT INTO admin_user_roles (admin_user_id,role_id) VALUES
(1,1),(2,2),(3,6);

INSERT INTO restaurants
(id,public_id,code,name,description,phone,email,address,district,city,latitude,longitude,hero_image_url,status)
VALUES
(1,UUID(),'BZV-CENTRE','TiopTiop Centre-ville','Restaurant principal TiopTiop au cœur de Brazzaville.','+242060000001','centre@tioptiop.cg','Centre-ville','Centre-ville','Brazzaville',-4.2673000,15.2919000,'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1600&q=85','OPEN'),
(2,UUID(),'BZV-POTO','TiopTiop Poto-Poto','Point de vente TiopTiop à Poto-Poto.','+242060000002','potopoto@tioptiop.cg','Poto-Poto','Poto-Poto','Brazzaville',-4.2575000,15.2768000,'https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1600&q=85','OPEN');

INSERT INTO restaurant_opening_hours
(restaurant_id,day_of_week,open_time,close_time,is_closed)
VALUES
(1,0,'06:00:00','23:00:00',0),(1,1,'06:00:00','23:00:00',0),
(1,2,'06:00:00','23:00:00',0),(1,3,'06:00:00','23:00:00',0),
(1,4,'06:00:00','23:00:00',0),(1,5,'06:00:00','23:00:00',0),
(1,6,'06:00:00','23:00:00',0),
(2,0,'07:00:00','22:30:00',0),(2,1,'07:00:00','22:30:00',0),
(2,2,'07:00:00','22:30:00',0),(2,3,'07:00:00','22:30:00',0),
(2,4,'07:00:00','22:30:00',0),(2,5,'07:00:00','22:30:00',0),
(2,6,'07:00:00','22:30:00',0);

INSERT INTO delivery_zones
(restaurant_id,name,min_order,delivery_fee,free_delivery_from,estimated_min_minutes,estimated_max_minutes)
VALUES
(1,'Centre-ville',5000,1000,20000,15,30),
(1,'Poto-Poto',5000,1500,25000,20,35),
(1,'Bacongo',7000,2000,30000,25,45),
(2,'Poto-Poto proximité',5000,1000,20000,15,30);

INSERT INTO categories
(id,name,slug,description,image_url,icon,position)
VALUES
(1,'Traditions','traditions','Recettes traditionnelles congolaises','https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1200&q=85','🍲',1),
(2,'Grillades','grillades','Viandes et poissons braisés','https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1200&q=85','🔥',2),
(3,'Petit-déjeuner','petit-dejeuner','Mikate, bouillies et café','https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85','☕',3),
(4,'Accompagnements','accompagnements','Plantain, riz et extras','https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1200&q=85','🍌',4),
(5,'Boissons','boissons','Boissons fraîches et chaudes','https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1200&q=85','🥤',5),
(6,'Desserts','desserts','Desserts et gâteaux','https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1200&q=85','🍰',6);

INSERT INTO products
(id,public_id,category_id,sku,name,slug,short_description,description,price,preparation_minutes,spice_level,allergens,ingredients,is_halal,is_vegetarian,is_breakfast,is_featured,position)
VALUES
(1,UUID(),2,'GRI-001','Poulet Braisé TiopTiop','poulet-braise-tioptiop','Poulet braisé signature','Poulet mariné aux épices naturelles, braisé au feu et servi avec accompagnement au choix.',3500,25,2,'Peut contenir moutarde','Poulet, citron, ail, gingembre, épices',1,0,0,1,1),
(2,UUID(),1,'TRA-001','Saka-Saka + Poisson','saka-saka-poisson','Saka-saka traditionnel','Feuilles de manioc mijotées, poisson et accompagnement.',2500,30,1,'Poisson, arachide possible','Feuilles de manioc, poisson, aromates',0,0,0,1,2),
(3,UUID(),3,'PDJ-001','Mikate (beignets)','mikate','Beignets congolais','Mikate moelleux servis chauds.',1000,10,0,'Gluten','Farine, levure, sucre',0,1,1,1,3),
(4,UUID(),3,'PDJ-002','Bouillie de maïs','bouillie-mais','Bouillie chaude et onctueuse','Bouillie de maïs au lait ou sans lait.',1200,8,0,'Lait selon option','Maïs, eau, sucre',0,1,1,0,4),
(5,UUID(),1,'TRA-002','Haricots Rouge + Bœuf','haricots-rouge-boeuf','Haricots mijotés et bœuf','Haricots rouges, bœuf tendre et riz.',2800,22,1,'Aucun allergène majeur déclaré','Haricots, bœuf, tomate, oignon',1,0,0,1,5),
(6,UUID(),1,'TRA-003','Maboké de poisson','maboke-poisson','Poisson en papillote','Poisson cuit en papillote aux aromates.',4200,35,2,'Poisson','Poisson, citron, aromates, légumes',0,0,0,1,6),
(7,UUID(),4,'ACC-001','Banane Plantain','banane-plantain','Plantain doré','Plantain frit ou rôti.',1500,10,0,'Aucun allergène majeur déclaré','Banane plantain, huile',0,1,0,0,7),
(8,UUID(),5,'BOI-001','Jus de Bissap','jus-bissap','Bissap frais','Boisson fraîche à base d’hibiscus.',900,3,0,'Aucun allergène majeur déclaré','Hibiscus, eau, menthe, sucre',0,1,0,1,8),
(9,UUID(),5,'BOI-002','Café au lait','cafe-au-lait','Café du matin','Café chaud avec lait ou alternative végétale.',800,5,0,'Lait','Café, lait',0,1,1,0,9),
(10,UUID(),6,'DES-001','Gâteau Maison','gateau-maison','Gâteau du jour','Part de gâteau préparée sur place.',1500,3,0,'Gluten, œuf, lait','Farine, œuf, lait, sucre',0,1,0,0,10);

INSERT INTO product_images
(product_id,image_url,source_url,alt_text,position,is_primary)
VALUES
(1,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Poulet braisé',1,1),
(1,'https://images.unsplash.com/photo-1598103442097-8b74394b95c6?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Poulet grillé',2,0),
(2,'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Plat traditionnel',1,1),
(3,'https://images.unsplash.com/photo-1551024506-0bccd828d307?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Beignets',1,1),
(4,'https://images.unsplash.com/photo-1517673400267-0251440c45dc?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Petit-déjeuner',1,1),
(5,'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Haricots mijotés',1,1),
(6,'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Poisson',1,1),
(7,'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Plantain',1,1),
(8,'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Bissap',1,1),
(9,'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Café',1,1),
(10,'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=1400&q=85','https://unsplash.com/','Gâteau',1,1);

INSERT INTO restaurant_products
(restaurant_id,product_id,stock_quantity,is_available)
SELECT r.id,p.id,50,1
FROM restaurants r
CROSS JOIN products p;

INSERT INTO product_option_groups
(id,product_id,name,selection_type,is_required,min_select,max_select,position)
VALUES
(1,1,'Accompagnement','SINGLE',1,1,1,1),
(2,1,'Suppléments','MULTIPLE',0,0,3,2),
(3,4,'Type de lait','SINGLE',0,0,1,1);

INSERT INTO product_option_values
(option_group_id,name,price_delta,is_default,position)
VALUES
(1,'Alloco',0,1,1),
(1,'Riz blanc',0,0,2),
(1,'Frites',500,0,3),
(1,'Saka-Saka',800,0,4),
(2,'Extra plantain',1000,0,1),
(2,'Sauce maison',300,0,2),
(2,'Sans piment',0,0,3),
(3,'Lait entier',0,1,1),
(3,'Lait végétal',300,0,2),
(3,'Sans lait',0,0,3);

INSERT INTO formulas
(id,name,slug,description,price,is_featured,is_active)
VALUES
(1,'Formule Matin','formule-matin','2 Mikate + bouillie + café',2500,1,1),
(2,'Menu Brazza','menu-brazza','Poulet braisé + plantain + boisson',5500,1,1),
(3,'Menu Famille','menu-famille','Assortiment pour 4 personnes',15000,1,1);

INSERT INTO formula_items
(formula_id,product_id,label,quantity)
VALUES
(1,3,'Mikate',2),
(1,4,'Bouillie',1),
(1,9,'Café au lait',1),
(2,1,'Poulet braisé',1),
(2,7,'Plantain',1),
(2,8,'Boisson',1);

INSERT INTO formula_images
(formula_id,image_url,alt_text,position,is_primary)
VALUES
(1,'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1400&q=85','Formule petit-déjeuner',1,1),
(2,'https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1400&q=85','Menu Brazza',1,1),
(3,'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=85','Menu famille',1,1);

INSERT INTO promotions
(id,name,code,description,image_url,discount_type,discount_value,minimum_order,audience,starts_at,ends_at,is_active)
VALUES
(1,'-10% Menu Brazza','BRAZZA10','10% sur le Menu Brazza','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=85','PERCENT',10,3000,'ALL',DATE_SUB(NOW(),INTERVAL 2 DAY),DATE_ADD(NOW(),INTERVAL 30 DAY),1),
(2,'Double points Tiop+','DOUBLEPOINTS','Doublement des points fidélité','https://images.unsplash.com/photo-1607083206968-13611e3d76db?auto=format&fit=crop&w=1200&q=85','POINTS_MULTIPLIER',2,5000,'TIOP_PLUS',NOW(),DATE_ADD(NOW(),INTERVAL 14 DAY),1);

INSERT INTO loyalty_rewards
(id,name,description,image_url,points_cost,reward_type,reward_value,is_active)
VALUES
(1,'Bissap offert','Un jus de bissap offert','https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=1000&q=85',500,'PRODUCT',0,1),
(2,'Livraison offerte','Une livraison gratuite','https://images.unsplash.com/photo-1526367790999-0150786686a2?auto=format&fit=crop&w=1000&q=85',1000,'FREE_DELIVERY',0,1),
(3,'-20% Poulet braisé','Réduction sur le poulet signature','https://images.unsplash.com/photo-1532550907401-a500c9a57435?auto=format&fit=crop&w=1000&q=85',800,'DISCOUNT',20,1);

INSERT INTO loyalty_accounts
(user_id,points_balance,tier,subscribed_at)
VALUES
(1,1200,'TIOP_PLUS',DATE_SUB(NOW(),INTERVAL 3 MONTH)),
(2,2100,'TIOP_PLUS',DATE_SUB(NOW(),INTERVAL 8 MONTH)),
(3,620,'TIOP',NULL);

INSERT INTO orders
(id,public_id,reference,user_id,restaurant_id,delivery_address_id,order_type,channel,status,subtotal,delivery_fee,total_amount,created_at)
VALUES
(1,UUID(),'TIOP-78521',1,1,1,'DELIVERY','WEB','ON_THE_WAY',23500,1500,25000,DATE_SUB(NOW(),INTERVAL 50 MINUTE)),
(2,UUID(),'TIOP-78520',2,1,2,'PICKUP','POS','PREPARING',12500,0,12500,DATE_SUB(NOW(),INTERVAL 1 HOUR)),
(3,UUID(),'TIOP-78519',3,2,NULL,'DINE_IN','WEB','DELIVERED',8000,0,8000,DATE_SUB(NOW(),INTERVAL 2 HOUR));

INSERT INTO order_items
(order_id,product_id,product_name,unit_price,quantity,line_total)
VALUES
(1,1,'Poulet Braisé TiopTiop',3500,2,7000),
(1,6,'Maboké de poisson',4200,2,8400),
(1,7,'Banane Plantain',1500,2,3000),
(1,8,'Jus de Bissap',900,4,3600),
(2,5,'Haricots Rouge + Bœuf',2800,2,5600),
(2,1,'Poulet Braisé TiopTiop',3500,1,3500),
(3,3,'Mikate (beignets)',1000,4,4000),
(3,4,'Bouillie de maïs',1200,2,2400),
(3,9,'Café au lait',800,2,1600);

INSERT INTO payments
(id,public_id,order_id,method,status,amount,provider,paid_at)
VALUES
(1,UUID(),1,'MOBILE_MONEY','PAID',25000,'MTN Mobile Money',DATE_SUB(NOW(),INTERVAL 49 MINUTE)),
(2,UUID(),2,'CASH','PENDING',12500,NULL,NULL),
(3,UUID(),3,'CARD','PAID',8000,'DemoPay',DATE_SUB(NOW(),INTERVAL 2 HOUR));

INSERT INTO order_status_history
(order_id,status,comment,created_at)
VALUES
(1,'RECEIVED','Commande reçue',DATE_SUB(NOW(),INTERVAL 50 MINUTE)),
(1,'CONFIRMED','Commande confirmée',DATE_SUB(NOW(),INTERVAL 45 MINUTE)),
(1,'PREPARING','Préparation en cuisine',DATE_SUB(NOW(),INTERVAL 38 MINUTE)),
(1,'READY','Commande prête',DATE_SUB(NOW(),INTERVAL 22 MINUTE)),
(1,'ON_THE_WAY','Livreur en route',DATE_SUB(NOW(),INTERVAL 14 MINUTE)),
(2,'RECEIVED','Commande créée depuis le POS',DATE_SUB(NOW(),INTERVAL 1 HOUR)),
(2,'CONFIRMED','Commande confirmée',DATE_SUB(NOW(),INTERVAL 55 MINUTE)),
(2,'PREPARING','En cuisine',DATE_SUB(NOW(),INTERVAL 47 MINUTE)),
(3,'RECEIVED','Commande reçue',DATE_SUB(NOW(),INTERVAL 2 HOUR)),
(3,'DELIVERED','Commande terminée',DATE_SUB(NOW(),INTERVAL 90 MINUTE));

INSERT INTO deliveries
(id,order_id,driver_name,driver_phone,status,estimated_arrival,picked_up_at)
VALUES
(1,1,'Jean Pierre','+242066667788','ON_THE_WAY',DATE_ADD(NOW(),INTERVAL 18 MINUTE),DATE_SUB(NOW(),INTERVAL 14 MINUTE));

INSERT INTO delivery_tracking_points
(delivery_id,latitude,longitude,heading,speed_kmh,recorded_at)
VALUES
(1,-4.2712000,15.2821000,35,22,DATE_SUB(NOW(),INTERVAL 6 MINUTE)),
(1,-4.2691000,15.2854000,42,24,DATE_SUB(NOW(),INTERVAL 4 MINUTE)),
(1,-4.2668000,15.2887000,51,21,DATE_SUB(NOW(),INTERVAL 2 MINUTE));

INSERT INTO favorites (user_id,product_id)
VALUES (1,1),(1,2),(1,8),(2,6);

INSERT INTO product_reviews
(user_id,product_id,order_id,rating,title,comment)
VALUES
(1,1,1,5,'Excellent','Poulet très bon et bien braisé.'),
(2,5,2,5,'Très bon','Haricots très bien assaisonnés.'),
(3,3,3,4,'Bon petit-déjeuner','Mikate moelleux.');

INSERT INTO notifications
(user_id,channel,notification_type,title,body,sent_at)
VALUES
(1,'IN_APP','ORDER_STATUS','Votre commande est en route','Jean Pierre se rapproche de votre adresse.',NOW()),
(1,'PUSH','LOYALTY','Tiop+','Vous avez 1200 points disponibles.',NOW());

INSERT INTO support_tickets
(id,reference,user_id,order_id,subject,category,priority,status)
VALUES
(1,'SUP-1042',1,1,'Retard livraison','DELIVERY','HIGH','NEW');

INSERT INTO support_messages
(ticket_id,sender_type,sender_user_id,message)
VALUES
(1,'CUSTOMER',1,'Ma commande semble prendre du retard.');

INSERT INTO jobs
(id,public_id,title,slug,department,location,contract_type,experience_level,salary_min,salary_max,description,responsibilities,requirements,benefits,image_url,published_at)
VALUES
(1,UUID(),'Cuisinier(ère)','cuisinier','Restaurant','Brazzaville','CDI','1 à 2 ans',350000,450000,'Préparer les recettes TiopTiop et garantir la qualité.','Préparation; mise en place; hygiène; contrôle qualité','Cuisine congolaise; organisation; hygiène','Repas; formation; évolution','https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1200&q=85',DATE_SUB(NOW(),INTERVAL 10 DAY)),
(2,UUID(),'Livreur','livreur','Logistique','Brazzaville','CDD','Débutant accepté',250000,300000,'Assurer les livraisons et la relation client.','Livrer; suivre les itinéraires; confirmer les paiements espèces','Permis; smartphone; ponctualité','Prime de performance','https://images.unsplash.com/photo-1592838064575-70ed626d3a0e?auto=format&fit=crop&w=1200&q=85',DATE_SUB(NOW(),INTERVAL 7 DAY)),
(3,UUID(),'Caissier(ère)','caissier','Restaurant','Brazzaville','CDI','1 an',300000,350000,'Accueil, prise de commande, encaissement et suivi de caisse.','POS; caisse; accueil','Rigueur; relation client','Formation POS','https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1200&q=85',DATE_SUB(NOW(),INTERVAL 5 DAY));

INSERT INTO job_applications
(id,public_id,reference,job_id,user_id,first_name,last_name,email,phone,experience,availability,cover_message,source,status,internal_note,created_at)
VALUES
(1,UUID(),'TIOP-JOB-2026-0012',2,NULL,'Armand','B.','armand@example.com','+242067778899','2 ans de livraison','Disponible immédiatement','Je souhaite rejoindre TiopTiop pour participer au développement de la marque.','CAREERS_WEB','NEW','À contacter pour un premier échange.',DATE_SUB(NOW(),INTERVAL 2 HOUR)),
(2,UUID(),'TIOP-JOB-2026-0013',1,NULL,'Nadia','M.','nadia@example.com','+242055667788','3 ans en restauration','Disponible sous 2 semaines','Passionnée par la cuisine locale.','CAREERS_WEB','REVIEW',NULL,DATE_SUB(NOW(),INTERVAL 1 DAY));

INSERT INTO job_application_documents
(application_id,document_type,file_name,file_url,mime_type,file_size)
VALUES
(1,'CV','CV_Armand_B.pdf','/uploads/demo-CV_Armand_B.pdf','application/pdf',125000),
(2,'CV','CV_Nadia_M.pdf','/uploads/demo-CV_Nadia_M.pdf','application/pdf',143000);

INSERT INTO cms_pages
(slug,title,excerpt,content_html,hero_image_url,seo_title,seo_description,status,published_at)
VALUES
('histoire','Notre histoire','Le Congo, servi autrement.','<h2>Faire rayonner la cuisine congolaise</h2><p>TiopTiop associe héritage culinaire, design, technologie et ambition entrepreneuriale.</p>','https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=85','Notre histoire — TiopTiop','Découvrez la vision de TiopTiop.','PUBLISHED',NOW()),
('conditions','Conditions générales','Commande, paiement et livraison.','<h2>Conditions générales</h2><p>Règles de commande, paiement, livraison, fidélité, remboursement et support.</p>',NULL,'Conditions — TiopTiop','Conditions générales TiopTiop.','PUBLISHED',NOW()),
('confidentialite','Politique de confidentialité','Protection des données.','<h2>Confidentialité</h2><p>Gestion des données personnelles, cookies et consentements.</p>',NULL,'Confidentialité — TiopTiop','Politique de confidentialité TiopTiop.','PUBLISHED',NOW());

INSERT INTO faq_items
(category,question,answer_html,position)
VALUES
('COMMANDES','Comment suivre ma commande ?','Depuis Mes commandes, ouvrez la commande concernée puis consultez le suivi.',1),
('PAIEMENT','Comment fonctionne le paiement en espèces ?','Le paiement reste en attente jusqu’à confirmation de l’encaissement par le caissier ou le livreur.',2),
('TIOP_PLUS','Comment fonctionne Tiop+ ?','Vous cumulez des points et pouvez les échanger contre des récompenses.',3),
('COMPTE','Puis-je commander sans compte ?','Oui, en invité ou via une commande créée par le POS.',4),
('LIVRAISON','Puis-je programmer une commande ?','Oui, lorsque le restaurant et le créneau sélectionné le permettent.',5);

INSERT INTO system_settings
(setting_key,setting_value,description)
VALUES
('restaurant.brand',JSON_OBJECT('name','TiopTiop','country','Congo-Brazzaville','currency','XAF','timezone','Africa/Brazzaville'),'Paramètres de la marque'),
('orders.config',JSON_OBJECT('allow_guest',1,'allow_scheduled',1,'minimum_order',5000),'Configuration des commandes'),
('delivery.config',JSON_OBJECT('default_fee',1500,'free_from',20000,'tracking_enabled',1),'Configuration des livraisons'),
('payments.config',JSON_OBJECT('cash',1,'mobile_money',1,'card',1),'Moyens de paiement'),
('loyalty.config',JSON_OBJECT('enabled',1,'points_per_1000_xaf',10),'Programme Tiop+'),
('notifications.config',JSON_OBJECT('push',1,'email',1,'sms',0),'Notifications');

INSERT INTO audit_logs
(admin_user_id,action,entity_type,entity_id,new_value)
VALUES
(1,'LOGIN','ADMIN_USER','1',JSON_OBJECT('status','success')),
(2,'UPDATE_ORDER_STATUS','ORDER','2',JSON_OBJECT('status','PREPARING')),
(3,'OPEN_SUPPORT_TICKET','SUPPORT_TICKET','1',JSON_OBJECT('status','NEW'));

SET FOREIGN_KEY_CHECKS = 1;

-- =====================================================================
-- VERIFICATIONS
-- =====================================================================

SELECT COUNT(*) AS nb_clients FROM users;
SELECT COUNT(*) AS nb_produits FROM products;
SELECT COUNT(*) AS nb_images_produits FROM product_images;
SELECT COUNT(*) AS nb_commandes FROM orders;
SELECT COUNT(*) AS nb_candidatures FROM job_applications;
SELECT COUNT(*) AS nb_tables
FROM information_schema.tables
WHERE table_schema = 'tioptiop';

-- Fin du fichier
