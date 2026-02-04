// Database schema definition for diesel ORM

diesel::table! {
    admin_sessions (session_token) {
        #[max_length = 36]
        session_token -> Varchar,
        created_at -> Nullable<Timestamp>,
        expires_at -> Nullable<Timestamp>,
        #[max_length = 45]
        ip_address -> Nullable<Varchar>,
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
        description -> Nullable<Text>,
        link -> Nullable<Text>,
        image -> Nullable<Binary>,
        image_mime -> Nullable<Varchar>,
        created_at -> Timestamp,
        latitude -> Nullable<Double>,
        longitude -> Nullable<Double>,
    }
}

diesel::allow_tables_to_appear_in_same_query!(admin_sessions, messages, messages_archive, offers,);
