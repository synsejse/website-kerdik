use bcrypt::{hash, DEFAULT_COST};
use clap::Parser;

#[derive(Parser)]
#[command(author, version, about = "Generate bcrypt hashes")]
struct Args {
    /// Password to hash.
    password: String,
}

fn main() {
    let args = Args::parse();
    match hash(args.password, DEFAULT_COST) {
        Ok(hashed) => println!("ADMIN_PASSWORD_HASH=\'{}\'", hashed),
        Err(err) => {
            eprintln!("Hash error: {err}");
            std::process::exit(1);
        }
    }
}
