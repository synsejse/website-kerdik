// Database schema definition for diesel ORM

diesel::table! {
    blog_posts (id) {
        id -> BigInt,
        title -> Text,
        slug -> Text,
        excerpt -> Nullable<Text>,
        content -> Text,
        image -> Nullable<Binary>,
        image_mime -> Nullable<Varchar>,
        published -> Bool,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    messages (id) {
        id -> BigInt,
        name -> Text,
        email -> Text,
        phone -> Nullable<Text>,
        subject -> Nullable<Text>,
        message -> Text,
        created_at -> Timestamp,
    }
}

diesel::table! {
    messages_archive (id) {
        id -> BigInt,
        original_id -> BigInt,
        name -> Text,
        email -> Text,
        phone -> Nullable<Text>,
        subject -> Nullable<Text>,
        message -> Text,
        created_at -> Timestamp,
        archived_at -> Timestamp,
    }
}

diesel::table! {
    offers (id) {
        id -> BigInt,
        title -> Text,
        slug -> Text,
        excerpt -> Nullable<Text>,
        content -> Nullable<Text>,
        link -> Nullable<Text>,
        image -> Nullable<Binary>,
        image_mime -> Nullable<Varchar>,
        created_at -> Timestamp,
        latitude -> Nullable<Double>,
        longitude -> Nullable<Double>,
    }
}

diesel::table! {
    admin_users (id) {
        id -> BigInt,
        username -> Varchar,
        password_hash -> Varchar,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::table! {
    admin_user_invites (id) {
        id -> BigInt,
        username -> Varchar,
        token -> Varchar,
        expires_at -> Timestamp,
        created_at -> Timestamp,
        created_by -> Nullable<BigInt>,
    }
}

diesel::table! {
    emergency_banners (id) {
        id -> BigInt,
        title -> Varchar,
        message -> Text,
        tone -> Varchar,
        link_label -> Nullable<Varchar>,
        link_url -> Nullable<Text>,
        is_active -> Bool,
        created_at -> Timestamp,
        updated_at -> Timestamp,
    }
}

diesel::allow_tables_to_appear_in_same_query!(
    admin_user_invites,
    admin_users,
    blog_posts,
    emergency_banners,
    messages,
    messages_archive,
    offers,
);
